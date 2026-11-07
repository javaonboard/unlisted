import { and, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { firstName, logStep } from "@/lib/db/activity";
import { AFTER_HANDOFF } from "@/lib/payments/states";

type Room = typeof schema.negotiations.$inferSelect;
const by = (f: { itemId?: string; intentId?: string }) => (f.itemId ? eq(schema.negotiations.itemId, f.itemId) : eq(schema.negotiations.intentId, f.intentId!));

// An agreed deal that isn't handed over yet has to be finished or backed out first.
export async function hasOpenDeal(f: { itemId?: string; intentId?: string }) {
  const agreed = await db.select({ id: schema.negotiations.id }).from(schema.negotiations).where(and(by(f), eq(schema.negotiations.status, "agreed")));
  if (!agreed.length) return false;
  const legs = await db.select({ roomId: schema.dealLegs.roomId, status: schema.dealLegs.status }).from(schema.dealLegs).where(inArray(schema.dealLegs.roomId, agreed.map((r) => r.id)));
  return agreed.some((r) => !AFTER_HANDOFF.includes(legs.find((l) => l.roomId === r.id)?.status ?? ""));
}

// Talks still going end with a plain reason, and the other side hears it. Returns the rooms it closed.
export async function endTalks(f: { itemId?: string; intentId?: string }, userId: string, why: string, title: string, body: string) {
  const first = await firstName(userId);
  const closed: Room[] = await db
    .update(schema.negotiations)
    .set({ status: "closed", closedReason: `${first} ${why}` })
    .where(and(by(f), or(eq(schema.negotiations.status, "open"), eq(schema.negotiations.status, "waiting_owner"))))
    .returning();
  for (const room of closed) {
    await db.delete(schema.bookings).where(eq(schema.bookings.roomId, room.id));
    await logStep(room.id, userId, `${first} ${why}`);
    const otherId = room.buyerId === userId ? room.sellerId : room.buyerId;
    await notify(otherId, title, body, room.id);
  }
  return closed;
}
