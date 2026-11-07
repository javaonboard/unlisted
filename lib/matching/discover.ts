import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { findDemandFor, findSupplyFor } from "./matcher";

// Matches for one person: buyers for their things, and things for their needs.
export async function discoverFor(userId: string) {
  const [items, intents, users] = await Promise.all([
    db.select().from(schema.items).where(and(eq(schema.items.ownerId, userId), isNull(schema.items.removedAt))),
    db.select().from(schema.intents).where(eq(schema.intents.ownerId, userId)),
    db.select().from(schema.users),
  ]);
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  const demand = await Promise.all(
    items.map(async (item) => ({
      item,
      buyers: (await findDemandFor(item.id)).map((intent) => ({ intent, name: name(intent.ownerId) })),
    })),
  );

  const supply = await Promise.all(
    intents
      .filter((intent) => intent.type === "buy" || intent.type === "request_service")
      .map(async (intent) => {
        const items = await findSupplyFor(intent.id);
        return {
          intent,
          open: items.filter((i) => i.openToOffers).map((item) => ({ item, name: name(item.ownerId) })),
          privateCount: items.filter((i) => !i.openToOffers).length, // owners get asked first
        };
      }),
  );

  return { demand: demand.filter((d) => d.buyers.length), supply: supply.filter((s) => s.open.length || s.privateCount) };
}
