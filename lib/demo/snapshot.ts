import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Not part of the demo world: the snapshot itself, the event queue, and AI usage (a reset mustn't lift the daily limit).
const SKIP = ["demo_snapshots", "events", "ai_usage"];
const DAY = 86_400_000;

// The app's tables, parents before children.
async function tablesInOrder() {
  const tables = (await db.execute<{ name: string }>(sql`select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`))
    .map((r) => r.name)
    .filter((t) => !SKIP.includes(t));
  const links = await db.execute<{ child: string; parent: string }>(sql`select conrelid::regclass::text as child, confrelid::regclass::text as parent from pg_constraint where contype = 'f'`);
  const order: string[] = [];
  const visit = (t: string) => {
    if (order.includes(t)) return;
    for (const l of links) if (l.child === t && l.parent !== t && tables.includes(l.parent)) visit(l.parent);
    order.push(t);
  };
  tables.forEach(visit);
  return order;
}

// Keeps the demo world as it is now (right after seeding) as the starting point.
export async function saveSnapshot() {
  const data: Record<string, unknown[]> = {};
  for (const t of await tablesInOrder()) {
    const [row] = await db.execute<{ rows: unknown[] }>(sql`select coalesce(jsonb_agg(x), '[]'::jsonb) as rows from ${sql.identifier(t)} x`);
    data[t] = row.rows;
  }
  const takenAt = new Date();
  await db.insert(schema.demoSnapshots).values({ id: "demo", data, takenAt }).onConflictDoUpdate({ target: schema.demoSnapshots.id, set: { data, takenAt, resetAt: null } });
  console.log("[demo] snapshot saved");
}

// Puts the demo back to its starting point. Dates move forward by whole weeks, so weekdays stay the same
// and Saturday's plans are still ahead. At most once every 10 seconds, so a double click can't stack resets.
export async function resetDemo(by: "button" | "nightly") {
  const [snap] = await db
    .update(schema.demoSnapshots)
    .set({ resetAt: new Date() })
    .where(and(eq(schema.demoSnapshots.id, "demo"), or(isNull(schema.demoSnapshots.resetAt), lt(schema.demoSnapshots.resetAt, new Date(Date.now() - 10_000)))))
    .returning();
  if (!snap) return false;

  const days = Math.floor((Date.now() - snap.takenAt.getTime()) / DAY);
  const weeks = Math.ceil(days / 7); // same day: none; any later day: enough whole weeks to keep plans ahead
  const tables = await tablesInOrder();
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`truncate ${tables.map((t) => `"${t}"`).join(", ")} restart identity cascade`));
    for (const t of tables) {
      const rows = snap.data[t] ?? [];
      if (rows.length) await tx.execute(sql`insert into ${sql.identifier(t)} select * from jsonb_populate_recordset(null::${sql.identifier(t)}, ${JSON.stringify(rows)}::jsonb)`);
      if (!weeks) continue;
      const cols = await tx.execute<{ c: string }>(sql`select column_name as c from information_schema.columns where table_schema = 'public' and table_name = ${t} and data_type like 'timestamp%'`);
      if (cols.length) await tx.execute(sql.raw(`update "${t}" set ${cols.map(({ c }) => `"${c}" = "${c}" + interval '${weeks} weeks'`).join(", ")}`));
    }
    // Agreed times also live inside each move's terms.
    if (weeks) {
      await tx.execute(sql.raw(`update offers set terms = jsonb_set(terms, '{slotStart}', to_jsonb(to_char(((terms->>'slotStart')::timestamptz + interval '${weeks} weeks') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) where terms->>'slotStart' is not null`));
    }
  });
  console.log(`[demo] reset (${by}), dates moved ${weeks} week(s)`);
  return true;
}

// Each night around 3am Austin time the demo starts fresh.
export async function nightlyReset() {
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }));
  if (hour !== 3) return;
  const [snap] = await db.select({ resetAt: schema.demoSnapshots.resetAt }).from(schema.demoSnapshots).where(eq(schema.demoSnapshots.id, "demo"));
  if (snap && (!snap.resetAt || Date.now() - snap.resetAt.getTime() > 20 * 3_600_000)) await resetDemo("nightly");
}
