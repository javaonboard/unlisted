import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { waitingFor } from "./approval";

const QUIET = 30 * 60_000; // one nudge per deal every 30 minutes, so nobody gets spammed

// Remind the other person what the deal is waiting on: their approval, their payment, or confirming the handoff.
export async function nudge(roomId: string, userId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed" || (room.buyerId !== userId && room.sellerId !== userId)) return "Nothing to nudge.";
  const otherId = room.buyerId === userId ? room.sellerId : room.buyerId;
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.roomId, roomId));
  const [need] = await db.select({ type: schema.intents.type }).from(schema.intents).where(eq(schema.intents.id, room.intentId!));
  const [me] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId));
  const myName = me.name.split(" ")[0];
  const handoff = leg?.kind === "service" ? "confirm the job is done" : need?.type === "rent" ? "confirm you picked it up" : "confirm you have it";
  const what = waitingFor(room).includes(otherId)
    ? "approve the deal"
    : otherId === room.buyerId && (!leg || leg.status === "pending")
      ? "pay with PayPal"
      : otherId === room.buyerId && leg?.status === "held"
        ? `${handoff}, so PayPal pays ${myName}`
        : null;
  if (!what) return "They're not holding anything up.";

  const [claimed] = await db
    .update(schema.negotiations)
    .set({ nudgedAt: new Date() })
    .where(and(eq(schema.negotiations.id, roomId), or(isNull(schema.negotiations.nudgedAt), lt(schema.negotiations.nudgedAt, new Date(Date.now() - QUIET)))))
    .returning();
  if (!claimed) return "You nudged them recently. Give them a moment.";

  await notify(otherId, `${myName} is waiting on you`, `For “${room.label}”: please ${what}.`, roomId);
  return "Nudged. They'll see it in their Inbox.";
}
