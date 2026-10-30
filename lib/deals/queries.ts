import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Deals someone owns or takes part in.
export async function listDealsFor(userId: string) {
  const rooms = await db
    .select({ dealId: schema.negotiations.dealId })
    .from(schema.negotiations)
    .where(or(eq(schema.negotiations.buyerId, userId), eq(schema.negotiations.sellerId, userId)));
  const ids = [...new Set(rooms.map((r) => r.dealId).filter(Boolean))] as string[];
  const owned = await db.select().from(schema.deals).where(eq(schema.deals.ownerId, userId));
  const joined = ids.length ? await db.select().from(schema.deals).where(inArray(schema.deals.id, ids)) : [];
  const all = [...owned, ...joined.filter((d) => !owned.some((o) => o.id === d.id))];
  return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Everything the deal channel shows, as seen by one viewer.
export async function getDealChannel(dealId: string, viewerId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal) return null;

  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, dealId)).orderBy(asc(schema.negotiations.createdAt));
  const visibleRooms = deal.ownerId === viewerId ? rooms : rooms.filter((r) => r.buyerId === viewerId || r.sellerId === viewerId);
  const roomIds = visibleRooms.map((r) => r.id);

  const [moves, users, bookings, legs, events] = await Promise.all([
    roomIds.length ? db.select().from(schema.offers).where(inArray(schema.offers.negotiationId, roomIds)).orderBy(asc(schema.offers.createdAt)) : [],
    db.select().from(schema.users),
    db.select().from(schema.bookings).where(and(eq(schema.bookings.dealId, dealId), eq(schema.bookings.userId, viewerId))).orderBy(desc(schema.bookings.startsAt)),
    db.select().from(schema.dealLegs).where(eq(schema.dealLegs.dealId, dealId)).orderBy(asc(schema.dealLegs.createdAt)),
    db.select().from(schema.activity).where(sql`${schema.activity.data}->>'dealId' = ${dealId}`).orderBy(asc(schema.activity.createdAt)),
  ]);

  // Talk between an agent and its owner is only for that owner.
  const messages = moves.filter((m) => (m.kind === "ask_owner" || m.kind === "owner_note" ? m.fromUserId === viewerId : true));
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const mine = deal.ownerId === viewerId;
  return {
    deal,
    rooms: visibleRooms,
    messages,
    bookings,
    names,
    legs: legs.filter((l) => mine || l.payerId === viewerId || l.payeeId === viewerId),
    events: events.filter((e) => mine || e.userId === null || e.userId === viewerId),
  };
}
