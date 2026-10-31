import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { confirmTime } from "@/lib/bookings";
import { confirmSoloDeal } from "@/lib/payments/legs";

// One "Accept": the person agrees to the deal and its time together.
// A one-off deal becomes payable on the first accept; a plan waits for its owner's approval.
export async function acceptDeal(roomId: string, userId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed" || (room.buyerId !== userId && room.sellerId !== userId)) return;
  if (!room.dealId) await confirmSoloDeal(roomId, userId);
  await confirmTime(roomId, userId);
}
