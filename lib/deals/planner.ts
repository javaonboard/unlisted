import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { rankBuyers, rankSellers } from "@/lib/scout/rank";
import { scoutNote } from "@/lib/scout/note";
import { inSentence } from "@/lib/text/words";

const SELL_AT_ONCE = 3;
const BUY_AT_ONCE = 2;

export type PlanChoice = { title: string; sellId?: string; buyId?: string; serviceId?: string; sellOnlyIfBought: boolean };

// Starts a plan from the owner's chosen needs: sell one thing, buy another, then book a
// service (a mover, an installer) around both. Nothing binds until the owner approves.
// With sellOnlyIfBought off, the sale runs on its own and the plan covers the rest.
export async function startLinkedDeal(ownerId: string, choice: PlanChoice) {
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, ownerId));
  const mine = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, ownerId), eq(schema.intents.status, "open")));
  const sell = mine.find((i) => i.id === choice.sellId && i.type === "sell");
  const buy = mine.find((i) => i.id === choice.buyId && i.type === "buy");
  const service = mine.find((i) => i.id === choice.serviceId && i.type === "request_service");
  if (!sell && !buy) throw new Error("A plan needs something to sell or to buy.");

  // The owner starting the plan is their yes: the item can now be offered.
  const [item] = sell
    ? await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.ownerId, ownerId), eq(schema.vaultItems.category, sell.category)))
    : [];
  if (item) await db.update(schema.vaultItems).set({ openToOffers: true }).where(eq(schema.vaultItems.id, item.id));

  // The Scout ranks everyone by public facts, then we talk to the best few.
  const [buyers, sellers, providers] = await Promise.all([
    item ? rankBuyers(item.id, owner.area) : Promise.resolve([]),
    buy ? rankSellers(buy.id, owner.area) : Promise.resolve([]),
    service ? rankSellers(service.id, owner.area) : Promise.resolve([]),
  ]);

  const note = await scoutNote([
    ...(item ? [{ label: `Selling your ${inSentence(item.title)}`, picks: buyers, chosen: SELL_AT_ONCE }] : []),
    ...(buy ? [{ label: `Buying: ${buy.text}`, picks: sellers, chosen: BUY_AT_ONCE }] : []),
    ...(service ? [{ label: `${service.text} (once the rest is agreed)`, picks: providers, chosen: 2 }] : []),
  ]);
  const [deal] = await db.insert(schema.deals).values({ ownerId, title: choice.title, scoutNote: note, serviceId: service?.id ?? null }).returning();

  const first = (name: string) => name.split(" ")[0];
  const inPlan = choice.sellOnlyIfBought ? deal.id : undefined; // a sale outside the plan is a normal deal
  const itemTitles = Object.fromEntries((await db.select({ id: schema.vaultItems.id, title: schema.vaultItems.title }).from(schema.vaultItems)).map((i) => [i.id, i.title]));
  const rooms = await Promise.all([
    ...(item ? buyers.slice(0, SELL_AT_ONCE) : []).map((b) =>
      openRoom({ dealId: inPlan, label: `${item.title} → ${first(b.name)}`, buyerId: b.userId, sellerId: ownerId, itemId: item.id, intentId: b.intentId! }),
    ),
    ...(buy ? sellers.slice(0, BUY_AT_ONCE) : []).map((s) =>
      openRoom({ dealId: deal.id, label: `${first(s.name)}'s ${inSentence(itemTitles[s.itemId!] ?? "item")}`, buyerId: ownerId, sellerId: s.userId, itemId: s.itemId!, intentId: buy!.id }),
    ),
  ]);

  after(() => Promise.all(rooms.map((r) => playRoom(r.id))).catch((e) => console.error("[deal] failed", e?.message)));
  return deal;
}
