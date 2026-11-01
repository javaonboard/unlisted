import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { confirmTime } from "@/lib/bookings";

type Room = { buyerId: string; sellerId: string; buyerApprovedAt: Date | null; sellerApprovedAt: Date | null };

// Who still has to approve the deal the agents agreed.
export const waitingFor = (room: Room) => [!room.buyerApprovedAt && room.buyerId, !room.sellerApprovedAt && room.sellerId].filter(Boolean) as string[];

// One person's yes. Safe to repeat: only the first one counts. Their calendar booking becomes final too.
export async function approve(roomId: string, userId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room) return;
  const field = room.buyerId === userId ? "buyerApprovedAt" : room.sellerId === userId ? "sellerApprovedAt" : null;
  if (!field) return;
  await db.update(schema.negotiations).set({ [field]: new Date() }).where(and(eq(schema.negotiations.id, roomId), isNull(schema.negotiations[field])));
  await confirmTime(roomId, userId);
}

// The time or place changed: the person who changed it stays approved, the other approves again.
export async function reapprove(roomId: string, changedBy: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room) return;
  const now = new Date();
  await db
    .update(schema.negotiations)
    .set({ buyerApprovedAt: room.buyerId === changedBy ? now : null, sellerApprovedAt: room.sellerId === changedBy ? now : null })
    .where(eq(schema.negotiations.id, roomId));
  await db.update(schema.bookings).set({ confirmedAt: null }).where(eq(schema.bookings.roomId, roomId));
  await confirmTime(roomId, changedBy);
}
