import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { findDemandFor, findSupplyFor } from "@/lib/matching/matcher";
import { openRoom, playRoom } from "@/lib/negotiation/room";

// Starts a linked deal from the owner's connected needs: sell one thing,
// buy another, then book a service around both. Nothing binds until approval.
export async function startLinkedDeal(ownerId: string, title: string) {
  const intents = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, ownerId), eq(schema.intents.status, "open")));
  const sell = intents.find((i) => i.type === "sell");
  const buy = intents.find((i) => i.type === "buy");
  if (!sell || !buy) throw new Error("A linked deal needs one thing to sell and one to buy.");

  // The owner starting the deal is their yes: the item can now be offered.
  const [item] = await db
    .select()
    .from(schema.vaultItems)
    .where(and(eq(schema.vaultItems.ownerId, ownerId), eq(schema.vaultItems.category, sell.category)));
  await db.update(schema.vaultItems).set({ openToOffers: true }).where(eq(schema.vaultItems.id, item.id));

  const users = await db.select().from(schema.users);
  const first = (id: string) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? id;

  const buyers = (await findDemandFor(item.id)).sort((a, b) => Number(b.maxPrice ?? 0) - Number(a.maxPrice ?? 0));
  const sellers = (await findSupplyFor(buy.id)).filter((i) => i.openToOffers);
  if (!buyers.length || !sellers.length) throw new Error("No match yet for one side of the deal.");

  const [deal] = await db.insert(schema.deals).values({ ownerId, title }).returning();
  // Talk to up to three buyers at once. The first to agree gets it.
  const sellRooms = await Promise.all(
    buyers.slice(0, 3).map((buyer) =>
      openRoom({
        dealId: deal.id,
        label: `${item.title.replace(/^Grey /, "")} → ${first(buyer.ownerId)}`,
        buyerId: buyer.ownerId,
        sellerId: ownerId,
        itemId: item.id,
        intentId: buyer.id,
      }),
    ),
  );
  const buyRoom = await openRoom({
    dealId: deal.id,
    label: `${sellers[0].title} ← ${first(sellers[0].ownerId)}`,
    buyerId: ownerId,
    sellerId: sellers[0].ownerId,
    itemId: sellers[0].id,
    intentId: buy.id,
  });

  after(() =>
    Promise.all([...sellRooms.map((r) => playRoom(r.id)), playRoom(buyRoom.id)]).catch((e) => console.error("[deal] failed", e?.message)),
  );
  return deal;
}
