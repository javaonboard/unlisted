"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { addFreeTime, clearFreeTimes } from "@/lib/availability";
import { askForNewTime } from "@/lib/negotiation/owner";
import { playRoom } from "@/lib/negotiation/room";

export async function markFreeAction(start: string, end: string) {
  await addFreeTime(await currentUserId(), new Date(start), new Date(end));
  revalidatePath("/schedule");
}

export async function clearFreeAction() {
  await clearFreeTimes(await currentUserId());
  revalidatePath("/schedule");
}

// Dragging a booking asks for that time; the agents settle it like any time change.
export async function moveBookingAction(bookingId: string, start: string) {
  const userId = await currentUserId();
  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
  if (!booking?.roomId || booking.userId !== userId) return;
  const when = new Date(start).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  await askForNewTime(booking.roomId, userId, `Move it to ${when} (${start})`);
  const roomId = booking.roomId;
  after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
  revalidatePath("/schedule");
}
