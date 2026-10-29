import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { counterpartySignals } from "./signals";
import type { Limits } from "./guardrails";

// Everything one side's agent needs for its next move, and nothing private
// from the other side.
export async function loadTurnContext(roomId: string, side: "buyer" | "seller") {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room?.itemId || !room.intentId) throw new Error(`room ${roomId} is missing its item or intent`);

  const ownerId = side === "buyer" ? room.buyerId : room.sellerId;
  const otherId = side === "buyer" ? room.sellerId : room.buyerId;

  const [[item], evidence, [intent], [owner], [other], [mandate], facts, moves] = await Promise.all([
    db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId)),
    db.select().from(schema.evidence).where(eq(schema.evidence.itemId, room.itemId)),
    db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId)),
    db.select().from(schema.users).where(eq(schema.users.id, ownerId)),
    db.select().from(schema.users).where(eq(schema.users.id, otherId)),
    db.select().from(schema.mandates).where(eq(schema.mandates.userId, ownerId)),
    db.select().from(schema.memoryFacts).where(eq(schema.memoryFacts.userId, ownerId)).orderBy(desc(schema.memoryFacts.confidence)).limit(5),
    db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(asc(schema.offers.round)),
  ]);

  const competing = await db
    .select({ id: schema.intents.id })
    .from(schema.intents)
    .where(and(eq(schema.intents.category, item.category), eq(schema.intents.type, "buy"), eq(schema.intents.status, "open"), ne(schema.intents.id, intent.id)));

  const limits: Limits =
    side === "buyer"
      ? { role: "buyer", limit: Math.min(Number(intent.maxPrice ?? Infinity), Number(mandate?.maxSpend ?? Infinity)) }
      : { role: "seller", limit: Number(item.minPrice ?? 0) };

  const lastFromOther = [...moves].reverse().find((m) => m.fromUserId === otherId && m.price);
  const signals = counterpartySignals({
    moves,
    counterpartyId: otherId,
    counterpartyBio: other.bio,
    counterpartyDueAt: side === "seller" ? intent.dueAt : null,
    competingInterest: side === "seller" ? competing.length : 0,
    round: room.round,
    maxRounds: room.maxRounds,
  });

  return {
    room,
    side,
    owner,
    other,
    item,
    evidence,
    intent,
    limits,
    facts,
    moves,
    signals,
    standingPrice: lastFromOther ? Number(lastFromOther.price) : null,
  };
}

export type TurnContext = Awaited<ReturnType<typeof loadTurnContext>>;
