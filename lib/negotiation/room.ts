import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { loadTurnContext } from "./context";
import { decideMove } from "./agent";
import { toA2AMessage, type Move } from "./moves";

type NewRoom = { id?: string; dealId?: string; dependsOn?: string[]; label?: string; buyerId: string; sellerId: string; itemId: string; intentId: string };

export async function openRoom(input: NewRoom) {
  const [room] = await db.insert(schema.negotiations).values(input).returning();
  for (const userId of [input.buyerId, input.sellerId]) {
    await logActivity({ userId, type: "agent", message: "Your agent opened a negotiation.", data: { roomId: room.id } });
  }
  return room;
}

const termsOf = (move: Move) => ({ when: move.when, slotStart: move.slotStart, place: move.place, costs: move.costs, extras: move.extras });

// Plays the next turn. The buyer opens, then sides alternate.
// Returns false when the room is closed or waiting for an owner.
export async function playTurn(roomId: string): Promise<boolean> {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || room.status !== "open") return false;

  // A parallel negotiation already won: the item is sold, or the need is filled.
  const agreed = and(eq(schema.negotiations.status, "agreed"), ne(schema.negotiations.id, roomId));
  const [sold] = await db.select({ id: schema.negotiations.id }).from(schema.negotiations).where(and(eq(schema.negotiations.itemId, room.itemId!), agreed));
  const [filled] = await db.select({ id: schema.negotiations.id }).from(schema.negotiations).where(and(eq(schema.negotiations.intentId, room.intentId!), agreed));
  if (sold || filled) {
    const closedReason = sold ? "sold to someone else" : "went with another option";
    await db.update(schema.negotiations).set({ status: "closed", closedReason }).where(eq(schema.negotiations.id, roomId));
    console.log(`[room] ${roomId.slice(0, 8)} closed: ${closedReason}`);
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
    await db.insert(schema.notifications).values({
      userId: context.owner.id,
      title: "Your agent has a question",
      body: move.askOwner.question,
      link: room.dealId ? `/deals/${room.dealId}` : `/rooms/${roomId}`,
    });
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
    signalsUsed: move.signalsUsed,
    a2a: toA2AMessage(move, context.owner.id, roomId),
  });
  console.log(`[room] ${roomId.slice(0, 8)} round ${round} ${side}: ${move.action}${price ? ` $${price}` : ""}`);

  const closing = ["accept", "reject", "walk_away"].includes(move.action) || round >= room.maxRounds;
  await db
    .update(schema.negotiations)
    .set({
      round,
      status: move.action === "accept" ? "agreed" : closing ? "closed" : "open",
      agreedPrice: move.action === "accept" ? price?.toFixed(2) : undefined,
      closedReason: closing && move.action !== "accept" ? (round >= room.maxRounds ? "round limit" : move.action) : undefined,
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

  const closing = ["accept", "reject", "walk_away"].includes(move.action) || round >= room.maxRounds;
  await db
    .update(schema.negotiations)
    .set({
      round,
      status: move.action === "accept" ? "agreed" : closing ? "closed" : "open",
      agreedPrice: move.action === "accept" ? price?.toFixed(2) : undefined,
      closedReason: closing && move.action !== "accept" ? move.action : undefined,
    })
    .where(eq(schema.negotiations.id, roomId));
}

// Plays until the room closes or waits for an owner, then lets the deal react.
export async function playRoom(roomId: string) {
  while (await playTurn(roomId)) {}
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));

  // A finished deal teaches each owner's agent something, and services get booked.
  if (room.status === "agreed") {
    const { bookAgreedService } = await import("@/lib/bookings");
    await bookAgreedService(roomId);
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
