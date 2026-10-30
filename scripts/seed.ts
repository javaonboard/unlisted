// Resets the demo world.  npm run db:seed
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { nextSaturday } from "@/lib/dates";
import * as data from "./seed-data";

async function main() {
  await db.execute(sql`truncate users, mandates, vault_items, evidence, intents, negotiations,
    offers, deals, deal_legs, bookings, activity, notifications, memory_facts restart identity cascade`);

  await db.insert(schema.users).values(data.users.map((u) => ({ ...u, connectorKey: randomBytes(12).toString("hex") })));
  await db.insert(schema.mandates).values(data.mandates);

  const items = await db
    .insert(schema.vaultItems)
    .values(data.vaultItems.map(({ key: _key, ...item }) => item))
    .returning({ id: schema.vaultItems.id });
  const itemId = Object.fromEntries(data.vaultItems.map((item, i) => [item.key, items[i].id]));

  await db.insert(schema.evidence).values(
    data.evidence.map(({ itemKey, ...e }) => ({ ...e, itemId: itemId[itemKey] })),
  );

  // Insert intents first, then link the dependencies by id.
  const day = 24 * 60 * 60 * 1000;
  const rows = await db
    .insert(schema.intents)
    .values(
      data.intents.map(({ key: _key, dependsOn: _deps, dueInDays, ...intent }) => ({
        ...intent,
        dueAt: intent.ownerId === "maya" ? nextSaturday(18) : dueInDays ? new Date(Date.now() + dueInDays * day) : null,
      })),
    )
    .returning({ id: schema.intents.id });
  const intentId = Object.fromEntries(data.intents.map((intent, i) => [intent.key, rows[i].id]));
  for (const intent of data.intents) {
    if (!intent.dependsOn?.length) continue;
    await db
      .update(schema.intents)
      .set({ dependsOn: intent.dependsOn.map((key) => intentId[key]) })
      .where(sql`${schema.intents.id} = ${intentId[intent.key]}`);
  }

  await db.insert(schema.bookings).values(
    data.bookings.map((b) => ({ userId: b.providerId, title: b.title, startsAt: nextSaturday(b.startHour), endsAt: nextSaturday(b.endHour) })),
  );
  await db.insert(schema.memoryFacts).values(data.memoryFacts);
  await db.insert(schema.notifications).values(data.notifications);

  console.log(`seeded ${data.users.length} users, ${items.length} vault items, ${rows.length} intents`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
