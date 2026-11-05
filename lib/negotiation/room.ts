import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { logActivity } from "@/lib/db/activity";
import { loadTurnContext } from "./context";
import { decideMove } from "./agent";
import { toA2AMessage, type Move } from "./moves";
import { claimAgreement, settleAgreement } from "./claim";
import { usesOf } from "@/lib/deals/usage";

type NewRoom = { id?: string; dealId?: string; dependsOn?: string[]; stops?: string[]; label?: string; buyerId: string; sellerId: string; itemId: string; intentId: string };

export async function openRoom(input: NewRoom) {
  const [room] = await db.insert(schema.negotiations).values(input).returning();
  // A suggestion to talk about this same thing and need is now underway: clear it.
  await db
    .update(schema.suggestions)
    .set({ status: "expired" })
    .where(and(eq(schema.suggestions.status, "new"), eq(schema.suggestions.needId, input.intentId), sql`${schema.suggestions.action}->>'itemId' = ${input.itemId}`));
  for (const userId of [input.buyerId, input.sellerId]) {
    await logActivity({ userId, type: "agent", message: "Your agent opened a negotiation.", data: { roomId: room.id } });
  }
  return room;
}

// How a talk ended, in plain words.
const ENDED: Record<string, string> = { reject: "they said no", walk_away: "they walked away" };

const termsOf = (move: Move) => ({ when: move.when, slotStart: move.slotStart, place: move.place, meetAt: move.meetAt, costs: move.costs, extras: move.extras });

// Plays the next turn. The buyer opens, then sides alternate.
// Returns false when the room is closed or waiting for an owner.
export async function playTurn(roomId: string): Promise<boolean> {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || room.status !== "open") return false;

  // A parallel negotiation already won: the item is sold, or the need is filled.
  // A service isn't used up: a provider can take many jobs. A rental only blocks its own days (checked when agreeing).
  const agreed = and(eq(schema.negotiations.status, "agreed"), ne(schema.negotiations.id, roomId));
  const [item] = await db.select({ kind: schema.items.kind }).from(schema.items).where(eq(schema.items.id, room.itemId!));
  const others = item?.kind === "goods" ? await db.select().from(schema.negotiations).where(and(eq(schema.negotiations.itemId, room.itemId!), agreed)) : [];
  const uses = await usesOf(others);
  const sold = others.find((r) => uses.get(r.id)!.sale);
  const [filled] = await db.select({ id: schema.negotiations.id }).from(schema.negotiations).where(and(eq(schema.negotiations.intentId, room.intentId!), agreed));
  if (sold || filled) {
    const closedReason = sold ? "sold to someone else" : "went with another option";
    await db.update(schema.negotiations).set({ status: "closed", closedReason }).where(eq(schema.negotiations.id, roomId));
    console.log(`[room] ${roomId.slice(0, 8)} closed: ${closedReason}`);
    return false;
  }

  // Stopped (a restart) after both said yes but before it was settled: settle it now.
  const [last] = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(desc(schema.offers.createdAt)).limit(1);
  if (last?.kind === "accept" && last.round === room.round) {
    await settleAgreement(roomId, room.round, last.price ?? undefined);
    return false;
  }

  const side = (room.round + 1) % 2 === 1 ? "buyer" : "seller";
  const context = await loadTurnContext(roomId, side);
  const move = await decideMove(context);

  // Asking the owner pauses the room. It does not use up a round.
  if (move.action === "ask_owner" && move.askOwner) {
    await db.insert(schema.offers).values({
      negotiationId: roomId,
      fromUserId: context.owner.id,
      round: room.round,
      kind: "ask_owner",
      price: move.askOwner.suggestedPrice?.toFixed(2),
      note: move.askOwner.question,
      reasoning: move.reasoning,
      signalsUsed: move.signalsUsed,
    });
    await db.update(schema.negotiations).set({ status: "waiting_owner" }).where(eq(schema.negotiations.id, roomId));
    await notify(context.owner.id, "A quick question", move.askOwner.question, roomId);
    console.log(`[room] ${roomId.slice(0, 8)} ${side} asks owner: ${move.askOwner.question}`);
    return false;
  }

  const round = room.round + 1;
  const price = move.action === "accept" ? context.standingPrice : move.price;
  await db.insert(schema.offers).values({
    negotiationId: roomId,
    fromUserId: context.owner.id,
    round,
    kind: move.action,
    price: price?.toFixed(2),
    terms: termsOf(move),
    evidenceIds: move.evidenceIds,
    note: move.message,
    reasoning: move.reasoning,
    overLimit: move.overLimitReason, // private: only the owner sees why their agent went past their limit
    signalsUsed: move.signalsUsed,
    a2a: toA2AMessage(move, context.owner.id, roomId),
  });
  console.log(`[room] ${roomId.slice(0, 8)} round ${round} ${side}: ${move.action}${price ? ` $${price}` : ""}`);

  const closing = ["accept", "reject", "walk_away"].includes(move.action) || round >= room.maxRounds;
  if (move.action === "accept") {
    await settleAgreement(roomId, round, price?.toFixed(2)); // only one deal per goods or need, the best one
    return false;
  }
  await db
    .update(schema.negotiations)
    .set({
      round,
      status: closing ? "closed" : "open",
      closedReason: closing ? (round >= room.maxRounds ? "no deal in time" : ENDED[move.action]) : undefined,
    })
    .where(eq(schema.negotiations.id, roomId));

  return !closing;
}

// Saves a move that came from an outside agent (over A2A) as the next round.
export async function recordOutsideMove(roomId: string, fromUserId: string, move: Move, a2a: Record<string, unknown>) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  const round = room.round + 1;
  const last = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId));
  const standing = [...last].sort((a, b) => b.round - a.round).find((m) => m.fromUserId !== fromUserId && m.price);
  const price = move.action === "accept" ? (standing ? Number(standing.price) : null) : move.price;

  await db.insert(schema.offers).values({
    negotiationId: roomId,
    fromUserId,
    round,
    kind: move.action,
    price: price?.toFixed(2),
    terms: termsOf(move),
    evidenceIds: move.evidenceIds,
    note: move.message,
    a2a,
  });

  if (move.action === "accept") {
    await claimAgreement(roomId, round, price?.toFixed(2));
    return;
  }
  const closing = ["reject", "walk_away"].includes(move.action) || round >= room.maxRounds;
  await db
    .update(schema.negotiations)
    .set({ round, status: closing ? "closed" : "open", closedReason: closing ? ENDED[move.action] : undefined })
    .where(eq(schema.negotiations.id, roomId));
}

// Plays until the room closes or waits for an owner, then lets the deal react.
export async function playRoom(roomId: string) {
  while (await playTurn(roomId)) {}
  let [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));

  // A time change that went nowhere keeps the deal and the old time.
  const [booked] = await db.select().from(schema.bookings).where(eq(schema.bookings.roomId, roomId)).limit(1);
  if (room.status === "closed" && booked) {
    [room] = await db.update(schema.negotiations).set({ status: "agreed", closedReason: null }).where(eq(schema.negotiations.id, roomId)).returning();
    for (const userId of [room.buyerId, room.sellerId]) {
      await notify(userId, "No better time found", "The old time stands. Confirm it or ask again.", roomId);
    }
  }

  // A finished deal teaches each owner's agent something, and services get booked.
  if (room.status === "agreed") {
    const { bookAgreedDeal } = await import("@/lib/bookings");
    await bookAgreedDeal(roomId);
    const { learnFromRoom } = await import("@/lib/memory/extract");
    for (const ownerId of [room.buyerId, room.sellerId]) {
      learnFromRoom(roomId, ownerId).catch((e) => console.error("[memory] failed", e?.message));
    }
  }

  if (room.dealId && room.status !== "waiting_owner") {
    const { onLegFinished } = await import("@/lib/deals/coordinator");
    await onLegFinished(room.dealId);
  }
  return room;
}
