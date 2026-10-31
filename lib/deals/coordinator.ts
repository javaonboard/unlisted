import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { rankBuyers, rankSellers } from "@/lib/scout/rank";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { inSentence } from "@/lib/text/words";
import { stopsFor } from "./stops";

type Room = typeof schema.negotiations.$inferSelect;
type Deal = typeof schema.deals.$inferSelect;

const MAX_TRIES = 5;
const starting = new Set<string>(); // plans whose helpers are being booked right now
const live = (r: Room) => r.status === "open" || r.status === "waiting_owner";
const first = (name: string) => name.split(" ")[0];
const itemTitle = async (id: string) => (await db.select({ title: schema.vaultItems.title }).from(schema.vaultItems).where(eq(schema.vaultItems.id, id)))[0]?.title ?? "item";

// The plan's goods talks, grouped per thing being sold or bought.
function goodsGroups(deal: Deal, goods: Room[]) {
  const groups = new Map<string, Room[]>();
  for (const room of goods) {
    const key = room.sellerId === deal.ownerId ? `sell:${room.itemId}` : `buy:${room.intentId}`;
    groups.set(key, [...(groups.get(key) ?? []), room]);
  }
  return [...groups.entries()].map(([key, rooms]) => ({ selling: key.startsWith("sell"), rooms }));
}

// Called whenever a talk in a plan stops. Once every sale and purchase is agreed,
// the helpers (mover, installer…) are booked around those handoffs.
export async function onLegFinished(dealId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, dealId));
  const goods = rooms.filter((r) => !deal.helperIds.includes(r.intentId!));
  const groups = goodsGroups(deal, goods);

  // If every talk about one thing died, hop to the Scout's next candidate.
  if (await hopIfStuck(deal, groups)) return;

  const ready = groups.length > 0 && groups.every((g) => g.rooms.some((r) => r.status === "agreed") && !g.rooms.some(live));
  const waiting = deal.helperIds.filter((id) => !rooms.some((r) => r.intentId === id));
  if (!ready || !waiting.length || starting.has(dealId)) return;

  starting.add(dealId);
  try {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, deal.ownerId));
    const agreed = goods.filter((r) => r.status === "agreed");
    const stops = await stopsFor(deal.ownerId, agreed);
    const opened: Room[] = [];
    for (const needId of waiting) {
      // Talk to the Scout's top two helpers at once; the first fit wins and the other closes.
      for (const provider of (await rankSellers(needId, owner.area)).slice(0, 2)) {
        opened.push(
          await openRoom({
            dealId,
            label: `${first(provider.name)}: ${inSentence(await itemTitle(provider.itemId!))}`,
            dependsOn: agreed.map((r) => r.id), // the job is planned around these handoffs
            stops,
            buyerId: deal.ownerId,
            sellerId: provider.userId,
            itemId: provider.itemId!,
            intentId: needId,
          }),
        );
      }
    }
    await Promise.all(opened.map((room) => playRoom(room.id)));
  } finally {
    starting.delete(dealId);
  }
}

// Opens one more talk for a sale or purchase where nobody is talking and nothing was agreed.
async function hopIfStuck(deal: Deal, groups: { selling: boolean; rooms: Room[] }[]) {
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, deal.ownerId));
  for (const { selling, rooms: tried } of groups) {
    if (tried.length >= MAX_TRIES || tried.some((r) => r.status === "agreed" || live(r))) continue;

    const anchor = tried[0];
    const ranked = selling ? await rankBuyers(anchor.itemId!, owner.area) : await rankSellers(anchor.intentId!, owner.area);
    const next = ranked.find((p) => !tried.some((r) => (selling ? r.buyerId : r.sellerId) === p.userId));
    if (!next) continue;

    const room = await openRoom({
      dealId: deal.id,
      label: selling ? `${await itemTitle(anchor.itemId!)} → ${first(next.name)}` : `${first(next.name)}'s ${inSentence(await itemTitle(next.itemId!))}`,
      buyerId: selling ? next.userId : deal.ownerId,
      sellerId: selling ? deal.ownerId : next.userId,
      itemId: selling ? anchor.itemId! : next.itemId!,
      intentId: selling ? next.intentId! : anchor.intentId!,
    });
    console.log("[scout] hopping to", next.name);
    await playRoom(room.id);
    return true;
  }
  return false;
}
