import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// When a service is agreed with a time, put the job on the provider's calendar (once).
export async function bookAgreedService(roomId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed") return;
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!));
  if (item?.kind !== "skill") return;

  const existing = await db.select().from(schema.bookings).where(eq(schema.bookings.providerId, room.sellerId));
  if (existing.some((b) => b.title.includes(roomId.slice(0, 8)))) return;

  // The accept usually doesn't repeat the time: use the latest message that named a slot.
  const moves = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(desc(schema.offers.round));
  const slot = moves.map((m) => (m.terms as { slotStart?: string }).slotStart).find(Boolean);
  const start = new Date(slot ?? "");
  if (Number.isNaN(start.getTime())) return;

  await db.insert(schema.bookings).values({
    providerId: room.sellerId,
    title: `${room.label ?? item.title} (${roomId.slice(0, 8)})`,
    startsAt: start,
    endsAt: new Date(start.getTime() + 2 * 3_600_000),
    dealId: room.dealId,
  });
  console.log("[booking] booked", room.sellerId, start.toISOString());
}
