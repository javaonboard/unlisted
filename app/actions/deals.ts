"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { startLinkedDeal } from "@/lib/deals/planner";
import { applyOwnerReply, askForNewTime } from "@/lib/negotiation/owner";
import { confirmTime } from "@/lib/bookings";
import { playRoom } from "@/lib/negotiation/room";

export async function planMovingDay() {
  await startLinkedDeal(await currentUserId(), "Moving day");
  redirect("/vault");
}

// The owner answers their agent in their own words; the agent then carries on.
export async function replyToAgent(roomId: string, words: string) {
  await applyOwnerReply(roomId, await currentUserId(), words);
  after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
  revalidatePath("/", "layout");
}

export async function confirmTimeAction(roomId: string) {
  await confirmTime(roomId, await currentUserId());
  revalidatePath("/", "layout");
}

// Ask for another time in your own words; the agents settle it.
export async function changeTimeAction(roomId: string, words: string) {
  await askForNewTime(roomId, await currentUserId(), words);
  after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
  revalidatePath("/", "layout");
}
