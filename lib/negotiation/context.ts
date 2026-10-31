import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { counterpartySignals } from "./signals";
import { busyTimes } from "@/lib/bookings";
import { freeTimes } from "@/lib/availability";
import { placesFor } from "@/lib/deals/meet";
import type { Limits } from "./guardrails";

// Everything one side's agent needs for its next move, and nothing private
// from the other side.
export async function loadTurnContext(roomId: string, side: "buyer" | "seller") {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room?.itemId || !room.intentId) throw new Error(`room ${roomId} is missing its item or intent`);

  const ownerId = side === "buyer" ? room.buyerId : room.sellerId;
  const otherId = side === "buyer" ? room.sellerId : room.buyerId;

  const [[item], evidence, [intent], [owner], [other], [mandate], facts, allMoves] = await Promise.all([
    db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId)),
    db.select().from(schema.evidence).where(eq(schema.evidence.itemId, room.itemId)),
    db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId)),
    db.select().from(schema.users).where(eq(schema.users.id, ownerId)),
    db.select().from(schema.users).where(eq(schema.users.id, otherId)),
    db.select().from(schema.mandates).where(eq(schema.mandates.userId, ownerId)),
    db.select().from(schema.memoryFacts).where(eq(schema.memoryFacts.userId, ownerId)).orderBy(desc(schema.memoryFacts.confidence)).limit(5),
    db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(asc(schema.offers.createdAt)),
  ]);

  // Owner talk is private to each side.
  const isPrivate = (m: { kind: string }) => m.kind === "ask_owner" || m.kind === "owner_note";
  const moves = allMoves.filter((m) => !isPrivate(m));
  const ownerTalk = allMoves.filter((m) => isPrivate(m) && (m.fromUserId === ownerId || m.kind === "owner_note") && m.fromUserId === ownerId);

  const competing = await db
    .select({ id: schema.intents.id })
    .from(schema.intents)
    .where(and(eq(schema.intents.category, item.category), eq(schema.intents.type, "buy"), eq(schema.intents.status, "open"), ne(schema.intents.id, intent.id)));

  const buyerLimit = Number(room.buyerLimit ?? Math.min(Number(intent.maxPrice ?? Infinity), Number(mandate?.maxSpend ?? Infinity)));
  const sellerLimit = Number(room.sellerLimit ?? item.minPrice ?? 0);
  const limits: Limits =
    side === "buyer"
      ? { role: "buyer", limit: buyerLimit, target: Math.round(buyerLimit * 0.85) }
      : { role: "seller", limit: sellerLimit, target: Number(item.estimatedValue ?? sellerLimit) };

  // Other legs of the same deal, so this leg can fit around them.
  const legs = room.dealId
    ? await db.select().from(schema.negotiations).where(and(eq(schema.negotiations.dealId, room.dealId), ne(schema.negotiations.id, roomId)))
    : [];
  const legTerms = await Promise.all(
    legs.map(async (leg) => {
      const [last] = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, leg.id)).orderBy(desc(schema.offers.round)).limit(1);
      const terms = (last?.terms ?? {}) as { when?: string; place?: string };
      return `${leg.label}: ${leg.status}${leg.agreedPrice ? ` at $${leg.agreedPrice}` : ""}${terms.when ? `, ${terms.when}` : ""}${terms.place ? `, ${terms.place}` : ""}`;
    }),
  );

  // The deal owner's other needs, so legs plan around each other (e.g. a mover is coming).
  const [deal] = room.dealId ? await db.select().from(schema.deals).where(eq(schema.deals.id, room.dealId)) : [];
  const plan = deal
    ? (await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, deal.ownerId), eq(schema.intents.status, "open")))).map((i) => i.text)
    : [];

  // Both people's busy times, like a free/busy calendar. No details.
  const busy = [...(await busyTimes(ownerId, roomId)), ...(await busyTimes(otherId, roomId))];
  // Free hours, for whoever marked some. The time has to fall inside each such person's hours.
  const free = { you: await freeTimes(ownerId), them: await freeTimes(otherId) };
  // Where to meet without anyone driving past how far they said they'd go.
  const places = await placesFor(room);

  const lastFromOther = [...moves].reverse().find((m) => m.fromUserId === otherId && m.price);
  const signals = counterpartySignals({
    moves,
    counterpartyId: otherId,
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
    ownerTalk,
    alreadyAsked: allMoves.some((m) => m.kind === "ask_owner" && m.fromUserId === ownerId),
    legTerms,
    plan: deal && deal.ownerId === ownerId ? plan : [],
    busy,
    free,
    places,
    stops: room.stops,
    signals,
    standingPrice: lastFromOther ? Number(lastFromOther.price) : null,
  };
}

export type TurnContext = Awaited<ReturnType<typeof loadTurnContext>>;
