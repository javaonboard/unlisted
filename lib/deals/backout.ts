import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { voidAuthorization } from "@/lib/paypal/payments";
import { inSentence } from "@/lib/text/words";
import { AFTER_HANDOFF } from "@/lib/payments/states";

export const REASONS = {
  price: "the price",
  time: "the time or place",
  changed_mind: "changed their mind",
  found_other: "found another option",
  not_as_described: "it wasn't as described",
  no_answer: "no answer from the other side",
  other: "another reason",
} as const;
export type Reason = keyof typeof REASONS;

// Saying no before the handoff: the hold is released, calendars freed, the other side told why,
// and the pair isn't matched again. Returns the rooms to play next, or an error.
export async function backOut(roomId: string, userId: string, reason: Reason, note: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || (room.buyerId !== userId && room.sellerId !== userId)) return { error: "Not your deal." };
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.roomId, roomId));
  if (leg && (leg.status === "in_use" || AFTER_HANDOFF.includes(leg.status))) {
    return { error: leg.status === "in_use" ? "It's out on rent: bring it back first." : "It's already handed off. Use “Report a problem” instead." };
  }

  // Claimed in one step: a second click, or the other side backing out at the same time, does nothing.
  const [me] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId));
  const first = me.name.split(" ")[0];
  const [closed] = await db
    .update(schema.negotiations)
    .set({ status: "closed", closedReason: `${first} backed out: ${REASONS[reason]}`, backedOutBy: userId, backOutReason: reason, backOutNote: note || null })
    .where(and(eq(schema.negotiations.id, roomId), inArray(schema.negotiations.status, ["agreed", "open", "waiting_owner"])))
    .returning();
  if (!closed) return { error: null };

  // Money: nothing charged. A placed hold is released.
  if (leg?.status === "held" && leg.authorizationId) {
    await voidAuthorization(leg.authorizationId);
    await db.update(schema.dealLegs).set({ status: "voided" }).where(eq(schema.dealLegs.id, leg.id));
  } else if (leg?.status === "pending") {
    await db.update(schema.dealLegs).set({ status: "voided" }).where(eq(schema.dealLegs.id, leg.id));
  }
  await db.delete(schema.bookings).where(eq(schema.bookings.roomId, roomId));

  // The other side hears why, and their agent remembers it for next time (without naming anyone).
  const otherId = room.buyerId === userId ? room.sellerId : room.buyerId;
  const [item] = await db.select({ title: schema.items.title }).from(schema.items).where(eq(schema.items.id, room.itemId!));
  const what = inSentence(item?.title ?? "it");
  await notify(otherId, `${first} backed out of the ${what} deal`, `Reason: ${REASONS[reason]}${note ? `, “${note}”` : ""}. ${leg?.status === "held" ? "The PayPal hold was released, nothing was charged. " : ""}I'll look for someone else.`, roomId);
  await db.insert(schema.memoryFacts).values({
    userId: otherId,
    fact: `A deal for the ${what}${room.agreedPrice ? ` at $${Number(room.agreedPrice).toFixed(0)}` : ""} fell through: ${REASONS[reason]}.`,
    source: "back out",
    confidence: 0.7,
    verified: false,
  });
  if (reason === "not_as_described" && otherId === room.sellerId) {
    await notify(otherId, "Update your listing?", `The buyer said the ${what} wasn't as described. A clearer condition or a photo helps the next one go through.`);
  }
  return { error: null, room };
}

// Back on the market: a plan finds its next candidate; otherwise the item or need goes to the next best match.
export async function backOnTheMarket(room: typeof schema.negotiations.$inferSelect, userId: string) {
  if (room.dealId) {
    const [deal] = await db.select({ isPlan: schema.deals.isPlan }).from(schema.deals).where(eq(schema.deals.id, room.dealId));
    if (deal?.isPlan) {
      const { onLegFinished } = await import("./coordinator");
      await onLegFinished(room.dealId);
      return;
    }
  }
  if (userId === room.buyerId) {
    const [item] = await db.select().from(schema.items).where(eq(schema.items.id, room.itemId!));
    if (!item?.openToOffers) return;
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, item.ownerId));
    const { rankBuyers } = await import("@/lib/scout/rank");
    const talking = await db.select({ intentId: schema.negotiations.intentId }).from(schema.negotiations).where(and(eq(schema.negotiations.itemId, item.id), inArray(schema.negotiations.status, ["open", "waiting_owner", "agreed"])));
    const next = (await rankBuyers(item.id, owner.area)).find((p) => !talking.some((t) => t.intentId === p.intentId));
    if (!next) return;
    const { openRoom, playRoom } = await import("@/lib/negotiation/room");
    const fresh = await openRoom({ label: item.title, buyerId: next.userId, sellerId: item.ownerId, itemId: item.id, intentId: next.intentId! });
    await notify(item.ownerId, "Back on the market", `I'm talking to ${next.name.split(" ")[0]} next (${next.reasons.join(", ")}).`, fresh.id);
    await playRoom(fresh.id);
  } else {
    const { runWave } = await import("@/lib/suggestions/engine");
    await runWave(room.intentId!, 1);
  }
}
