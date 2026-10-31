import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { meetingPoint, type MeetAt } from "@/lib/deals/meet";

type Room = typeof schema.negotiations.$inferSelect;

async function names() {
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return Object.fromEntries(users.map((u) => [u.id, u.name]));
}

// Each negotiation with who is on the other side and the latest price.
async function summarize(rooms: Room[], viewerId: string) {
  const who = await names();
  return Promise.all(
    rooms.map(async (room) => {
      const moves = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, room.id));
      const last = moves.filter((m) => m.price && m.kind !== "ask_owner").sort((a, b) => b.round - a.round)[0];
      const otherId = room.buyerId === viewerId ? room.sellerId : room.buyerId;
      return { room, other: who[otherId] ?? otherId, lastPrice: last?.price ?? null };
    }),
  );
}

// An item someone owns, with every agent that reached out about it.
export async function getItemAnchor(itemId: string, viewerId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
  if (!item || item.ownerId !== viewerId) return null;
  const [evidence, rooms] = await Promise.all([
    db.select().from(schema.evidence).where(eq(schema.evidence.itemId, itemId)),
    db.select().from(schema.negotiations).where(eq(schema.negotiations.itemId, itemId)).orderBy(asc(schema.negotiations.createdAt)),
  ]);
  return { item, evidence, negotiations: await summarize(rooms, viewerId) };
}

// A need someone posted, with every agent that offered to fill it.
export async function getNeedAnchor(intentId: string, viewerId: string) {
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, intentId));
  if (!need || need.ownerId !== viewerId) return null;
  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.intentId, intentId)).orderBy(asc(schema.negotiations.createdAt));
  return { need, negotiations: await summarize(rooms, viewerId) };
}

// One negotiation, with what it depends on and what depends on it.
export async function getRoomView(roomId: string, viewerId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room) return null;
  const [deal] = room.dealId ? await db.select().from(schema.deals).where(eq(schema.deals.id, room.dealId)) : [];
  const isParty = room.buyerId === viewerId || room.sellerId === viewerId || deal?.ownerId === viewerId;
  if (!isParty) return null;

  const [[item], [need], moves, all, who] = await Promise.all([
    db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!)),
    db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId!)),
    db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(asc(schema.offers.createdAt)),
    room.dealId ? db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, room.dealId)) : Promise.resolve([] as Room[]),
    names(),
  ]);

  const visible = (r: Room) => r.buyerId === viewerId || r.sellerId === viewerId || deal?.ownerId === viewerId;
  const children = all.filter((r) => r.dependsOn.includes(room.id) && visible(r));

  // Payment and schedule for this deal.
  const [legs, bookings] = await Promise.all([
    room.dealId ? db.select().from(schema.dealLegs).where(eq(schema.dealLegs.dealId, room.dealId)) : Promise.resolve([]),
    db.select().from(schema.bookings).where(eq(schema.bookings.roomId, room.id)),
  ]);
  const leg = legs.find((l) => l.roomId === room.id) ?? null;
  const myPending = legs.filter((l) => l.payerId === viewerId && l.status === "pending");
  const agreedTerms = [...moves].reverse().find((m) => (m.terms as { when?: string }).when)?.terms as { when?: string; place?: string } | undefined;
  // Where to meet: set by hand, or what the agents agreed, or the usual for the kind of deal.
  const agreedMeetAt = [...moves].reverse().map((m) => (m.terms as { meetAt?: MeetAt }).meetAt).find(Boolean);
  const meetAt: MeetAt = room.meetAt ?? agreedMeetAt ?? (item.kind === "skill" ? "buyer_home" : "seller_home");
  // The exact address is only shared once the payment is held, and only with the two people in the deal.
  const party = room.buyerId === viewerId || room.sellerId === viewerId;
  const meet = party ? await meetingPoint(room, meetAt, viewerId, leg?.status === "held") : null;

  return {
    leg,
    meet,
    payTotal: myPending.reduce((sum, l) => sum + Number(l.amount), 0),
    planSettled: all.length > 0 && !all.some((r) => r.status === "open" || r.status === "waiting_owner"),
    hasLegs: legs.length > 0,
    booking: bookings.find((b) => b.userId === viewerId) ?? null,
    waitingOn: bookings.filter((b) => !b.confirmedAt).map((b) => b.userId), // who still has to confirm the time
    when: agreedTerms?.when ?? null,
    place: agreedTerms?.place ?? null,
    childSummaries: await Promise.all(
      children.map(async (c) => {
        const last = (await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, c.id))).filter((m) => m.price).sort((a, b) => b.round - a.round)[0];
        return { room: c, lastPrice: last?.price ?? null, when: (last?.terms as { when?: string } | undefined)?.when ?? null };
      }),
    ),
    room,
    deal,
    item,
    need,
    names: who,
    // Talk between an agent and its owner is only for that owner.
    messages: moves.filter((m) => (m.kind === "ask_owner" || m.kind === "owner_note" ? m.fromUserId === viewerId : true)),
    parents: all.filter((r) => room.dependsOn.includes(r.id) && visible(r)),
  };
}
