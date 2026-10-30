import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// When a deal is agreed with a time, put it on both people's calendars (once).
export async function bookAgreedDeal(roomId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed") return;
  const [existing] = await db.select().from(schema.bookings).where(eq(schema.bookings.roomId, roomId));
  if (existing) return;

  // The accept usually doesn't repeat the time: use the latest message that named one.
  const moves = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(desc(schema.offers.round));
  const slot = moves.map((m) => (m.terms as { slotStart?: string }).slotStart).find(Boolean);
  const start = new Date(slot ?? "");
  if (Number.isNaN(start.getTime())) return;

  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!));
  const users = await db.select().from(schema.users);
  const first = (id: string) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? id;
  const service = item.kind === "skill";
  const end = new Date(start.getTime() + (service ? 2 * 3_600_000 : 30 * 60_000));
  const what = item.title.toLowerCase();

  await db.insert(schema.bookings).values([
    { userId: room.sellerId, roomId, dealId: room.dealId, startsAt: start, endsAt: end, title: service ? `${item.title} for ${first(room.buyerId)}` : `Hand off ${what} to ${first(room.buyerId)}` },
    { userId: room.buyerId, roomId, dealId: room.dealId, startsAt: start, endsAt: end, title: service ? `${first(room.sellerId)}: ${what}` : `Pick up ${what} from ${first(room.sellerId)}` },
  ]);
  console.log("[booking] booked both sides", start.toISOString());
}

// Someone's busy times, without what they are (free/busy only).
export async function busyTimes(userId: string) {
  const rows = await db.select({ startsAt: schema.bookings.startsAt, endsAt: schema.bookings.endsAt }).from(schema.bookings).where(eq(schema.bookings.userId, userId));
  return rows;
}

export async function myBookings(userId: string, roomId?: string) {
  return db
    .select()
    .from(schema.bookings)
    .where(roomId ? and(eq(schema.bookings.userId, userId), eq(schema.bookings.roomId, roomId)) : eq(schema.bookings.userId, userId));
}
