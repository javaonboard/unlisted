// Resets the demo world.  npm run db:seed
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { nextSaturday } from "@/lib/dates";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { checkIn } from "@/lib/agent/checkin";
import { priceItem } from "@/lib/pricing/save";
import { inspectItem } from "@/lib/items/inspect";
import { saveSnapshot } from "@/lib/demo/snapshot";
import { existsSync, readFileSync } from "node:fs";
import * as data from "./seed-data";

async function main() {
  await db.execute(sql`truncate users, mandates, vault_items, evidence, intents, negotiations,
    offers, deals, deal_legs, bookings, free_times, activity, notifications, memory_facts restart identity cascade`);

  await db.insert(schema.users).values(data.users.map((u) => ({ ...u, connectorKey: randomBytes(12).toString("hex") })));
  await db.insert(schema.mandates).values(data.mandates);

  const items = await db
    .insert(schema.items)
    .values(data.items.map(({ key: _key, ...item }) => item))
    .returning({ id: schema.items.id });
  const itemId = Object.fromEntries(data.items.map((item, i) => [item.key, items[i].id]));

  // Demo photos live in public/seed (credits.txt there).
  const photoOf = (key: string) => (existsSync(`public/seed/${key}.jpg`) ? `/seed/${key}.jpg` : null);
  for (const item of data.items) {
    const photo = photoOf(item.key);
    if (photo) await db.update(schema.items).set({ photos: [photo] }).where(sql`${schema.items.id} = ${itemId[item.key]}`);
  }

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

  console.log(`seeded ${data.users.length} users, ${items.length} items, ${rows.length} intents`);

  // Real agents, one room at a time so calendars don't clash. Skip with --quiet.
  if (!process.argv.includes("--quiet")) {
    const owners = Object.fromEntries(data.items.map((item) => [item.key, item.ownerId]));
    const buyers = Object.fromEntries(data.intents.map((intent) => [intent.key, intent.ownerId]));
    // The agents look at each photo first, so what they saw is evidence in the talks.
    for (const item of data.items.filter((i) => photoOf(i.key))) {
      const image = `data:image/jpeg;base64,${readFileSync(`public/seed/${item.key}.jpg`).toString("base64")}`;
      await inspectItem(itemId[item.key], [image]).catch((e) => console.error("[inspect] skipped:", e.message));
    }
    for (const talk of data.talks) {
      const room = await openRoom({ label: talk.label, buyerId: buyers[talk.intentKey], sellerId: owners[talk.itemKey], itemId: itemId[talk.itemKey], intentId: intentId[talk.intentKey] });
      const done = await playRoom(room.id);
      console.log(`talk: ${talk.intentKey} → ${done.status}${done.agreedPrice ? ` $${done.agreedPrice}` : ""}`);
    }
    // Price advice (web search, Channel3, our sales) on the two things the demo sells.
    for (const key of ["sectional", "gpu2080"]) await priceItem(itemId[key]).catch((e) => console.error("[price] skipped:", e.message));
    // Then each person's agent takes its first look: buyers for private things, plans, missing pieces.
    for (const u of data.users) await checkIn(u.id, "a first look at their situation").catch((e) => console.error("[checkin] skipped:", e.message));
    await saveSnapshot(); // the starting point for "Reset demo" and the nightly reset
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
