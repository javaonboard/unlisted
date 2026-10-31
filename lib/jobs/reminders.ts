import { and, eq, gt, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";

const TITLE = "Today's handoff";

// On the day: remind both people of the time. The address and code are shown under the message.
export async function remindToday() {
  const now = new Date();
  const soon = new Date(now.getTime() + 12 * 3_600_000);
  const due = await db
    .select()
    .from(schema.bookings)
    .where(and(isNotNull(schema.bookings.roomId), gt(schema.bookings.startsAt, now), lt(schema.bookings.startsAt, soon)));

  for (const b of due) {
    const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.roomId, b.roomId!));
    if (leg?.status !== "held") continue; // only paid-into-hold deals happen
    const [sent] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, b.userId), eq(schema.notifications.roomId, b.roomId!), eq(schema.notifications.title, TITLE)));
    if (sent) continue;
    const time = b.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    await notify(b.userId, TITLE, `${b.title} at ${time}. Where to go and the handoff code are below.`, b.roomId);
  }
}
