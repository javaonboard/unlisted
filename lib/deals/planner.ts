import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { rankBuyers, rankSellers } from "@/lib/scout/rank";
import { scoutNote } from "@/lib/scout/note";
import { inSentence } from "@/lib/text/words";

const SELL_AT_ONCE = 3;
const BUY_AT_ONCE = 2;

export type PlanChoice = {
  title: string;
  sells: { needId: string; itemId: string }[];
  buyIds: string[];
  helperIds: string[];
  sellOnlyIfBought: boolean;
};

// Starts a plan from the owner's chosen needs: any number of sales and purchases, then helpers
// (a mover, an installer…) booked around the agreed handoffs. Nothing binds until the owner approves.
// With sellOnlyIfBought on, the sales can't be accepted until the purchases are agreed.
export async function startLinkedDeal(ownerId: string, choice: PlanChoice) {
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, ownerId));
  const mine = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, ownerId), eq(schema.intents.status, "open")));
  const things = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.ownerId, ownerId));
  const sells = choice.sells
    .map((s) => ({ need: mine.find((n) => n.id === s.needId && n.type === "sell"), item: things.find((i) => i.id === s.itemId) }))
    .filter((s): s is { need: (typeof mine)[number]; item: (typeof things)[number] } => !!s.need && !!s.item);
  const buys = mine.filter((n) => choice.buyIds.includes(n.id) && n.type === "buy");
  const helpers = mine.filter((n) => choice.helperIds.includes(n.id) && n.type === "request_service");
  if (!sells.length && !buys.length) throw new Error("A plan needs something to sell or to buy.");

  // The owner starting the plan is their yes: the items can now be offered.
  for (const s of sells) await db.update(schema.vaultItems).set({ openToOffers: true }).where(eq(schema.vaultItems.id, s.item.id));

  // The Scout ranks everyone by public facts, then we talk to the best few.
  const buyers = await Promise.all(sells.map((s) => rankBuyers(s.item.id, owner.area)));
  const sellers = await Promise.all(buys.map((b) => rankSellers(b.id, owner.area)));
  const providers = await Promise.all(helpers.map((h) => rankSellers(h.id, owner.area)));

  const note = await scoutNote([
    ...sells.map((s, i) => ({ label: `Selling your ${inSentence(s.item.title)}`, picks: buyers[i], chosen: SELL_AT_ONCE })),
    ...buys.map((b, i) => ({ label: `Buying: ${b.text}`, picks: sellers[i], chosen: BUY_AT_ONCE })),
    ...helpers.map((h, i) => ({ label: `${h.text} (once the rest is agreed)`, picks: providers[i], chosen: 2 })),
  ]);
  const [deal] = await db.insert(schema.deals).values({ ownerId, title: choice.title, scoutNote: note, helperIds: helpers.map((h) => h.id), isPlan: true, saleWaitsForPurchase: choice.sellOnlyIfBought && buys.length > 0 }).returning();

  const first = (name: string) => name.split(" ")[0];
  const itemTitles = Object.fromEntries((await db.select({ id: schema.vaultItems.id, title: schema.vaultItems.title }).from(schema.vaultItems)).map((i) => [i.id, i.title]));
  const rooms = await Promise.all([
    ...sells.flatMap((s, i) =>
      buyers[i].slice(0, SELL_AT_ONCE).map((b) =>
        openRoom({ dealId: deal.id, label: `${s.item.title} → ${first(b.name)}`, buyerId: b.userId, sellerId: ownerId, itemId: s.item.id, intentId: b.intentId! }),
      ),
    ),
    ...buys.flatMap((need, i) =>
      sellers[i].slice(0, BUY_AT_ONCE).map((s) =>
        openRoom({ dealId: deal.id, label: `${first(s.name)}'s ${inSentence(itemTitles[s.itemId!] ?? "item")}`, buyerId: ownerId, sellerId: s.userId, itemId: s.itemId!, intentId: need.id }),
      ),
    ),
  ]);

  after(() => Promise.all(rooms.map((r) => playRoom(r.id))).catch((e) => console.error("[deal] failed", e?.message)));
  return deal;
}
