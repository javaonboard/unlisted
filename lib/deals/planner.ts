import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { rankBuyers, rankSellers } from "@/lib/scout/rank";
import { scoutNote } from "@/lib/scout/note";

const SELL_AT_ONCE = 3;
const BUY_AT_ONCE = 2;

// Starts a linked deal from the owner's connected needs: sell one thing,
// buy another, then book a service around both. Nothing binds until approval.
export async function startLinkedDeal(ownerId: string, title: string) {
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, ownerId));
  const intents = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, ownerId), eq(schema.intents.status, "open")));
  const sell = intents.find((i) => i.type === "sell");
  const buy = intents.find((i) => i.type === "buy");
  const service = intents.find((i) => i.type === "request_service");
  if (!sell || !buy) throw new Error("A linked deal needs one thing to sell and one to buy.");

  // The owner starting the deal is their yes: the item can now be offered.
  const [item] = await db
    .select()
    .from(schema.vaultItems)
    .where(and(eq(schema.vaultItems.ownerId, ownerId), eq(schema.vaultItems.category, sell.category)));
  await db.update(schema.vaultItems).set({ openToOffers: true }).where(eq(schema.vaultItems.id, item.id));

  // The Scout ranks everyone by public facts, then we talk to the best few.
  const [buyers, sellers, movers] = await Promise.all([
    rankBuyers(item.id, owner.area),
    rankSellers(buy.id, owner.area),
    service ? rankSellers(service.id, owner.area) : Promise.resolve([]),
  ]);
  if (!buyers.length || !sellers.length) throw new Error("No match yet for one side of the deal.");

  const note = await scoutNote([
    { label: `Selling your ${item.title.toLowerCase()}`, picks: buyers, chosen: SELL_AT_ONCE },
    { label: `Buying: ${buy.text}`, picks: sellers, chosen: BUY_AT_ONCE },
    ...(service ? [{ label: "Mover, once the rest is agreed", picks: movers, chosen: 2 }] : []),
  ]);
  const [deal] = await db.insert(schema.deals).values({ ownerId, title, scoutNote: note }).returning();

  const first = (name: string) => name.split(" ")[0];
  const rooms = await Promise.all([
    ...buyers.slice(0, SELL_AT_ONCE).map((b) =>
      openRoom({ dealId: deal.id, label: `${item.title.replace(/^Grey /, "")} → ${first(b.name)}`, buyerId: b.userId, sellerId: ownerId, itemId: item.id, intentId: b.intentId! }),
    ),
    ...sellers.slice(0, BUY_AT_ONCE).map((s) =>
      openRoom({ dealId: deal.id, label: `${s.name.split(" ")[0]}'s sofa`, buyerId: ownerId, sellerId: s.userId, itemId: s.itemId!, intentId: buy.id }),
    ),
  ]);

  after(() => Promise.all(rooms.map((r) => playRoom(r.id))).catch((e) => console.error("[deal] failed", e?.message)));
  return deal;
}
