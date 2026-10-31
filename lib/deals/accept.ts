import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { confirmTime } from "@/lib/bookings";
import { openLeg } from "@/lib/payments/legs";
import { blockedBy } from "./dependency";

// One "Accept": the person agrees to the deal with its time and place. That opens its payment step.
// In a plan, a sale that waits for the purchase can't be accepted yet.
export async function acceptDeal(roomId: string, userId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed" || (room.buyerId !== userId && room.sellerId !== userId)) return;
  if (room.dealId) {
    const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, room.dealId));
    const planRooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, room.dealId));
    const waiting = blockedBy(room, deal, planRooms);
    if (waiting) throw new Error(`This deal is waiting for ${waiting}.`);
  }
  await openLeg(roomId);
  await confirmTime(roomId, userId);
}
