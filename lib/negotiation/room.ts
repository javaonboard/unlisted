import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { loadTurnContext } from "./context";
import { decideMove } from "./agent";
import { toA2AMessage, type Move } from "./moves";

// Opens a room between a buyer's intent and a seller's item.
export async function openRoom(input: { id?: string; buyerId: string; sellerId: string; itemId: string; intentId: string }) {
  const [room] = await db.insert(schema.negotiations).values(input).returning();
  await logActivity({ userId: input.sellerId, type: "agent", message: "Your agent opened a negotiation room.", data: { roomId: room.id } });
  await logActivity({ userId: input.buyerId, type: "agent", message: "Your agent opened a negotiation room.", data: { roomId: room.id } });
  return room;
}

// Plays the next turn. The buyer opens, then sides alternate.
// Returns false when the room is closed.
export async function playTurn(roomId: string): Promise<boolean> {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || room.status !== "open") return false;

  const round = room.round + 1;
  const side = round % 2 === 1 ? "buyer" : "seller";
  const context = await loadTurnContext(roomId, side);
  const move = await decideMove(context);

  const price = move.action === "accept" ? context.standingPrice : move.price;
  await db.insert(schema.offers).values({
    negotiationId: roomId,
    fromUserId: context.owner.id,
    round,
    kind: move.action,
    price: price?.toFixed(2),
    terms: { pickup: move.pickup, extras: move.extras },
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
    terms: { pickup: move.pickup, extras: move.extras },
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

export async function playRoom(roomId: string) {
  while (await playTurn(roomId)) {}
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  return room;
}
