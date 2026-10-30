"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { startLinkedDeal } from "@/lib/deals/planner";
import { applyOwnerReply } from "@/lib/negotiation/owner";
import { playRoom } from "@/lib/negotiation/room";

export async function planMovingDay() {
  const deal = await startLinkedDeal(await currentUserId(), "Moving day");
  redirect(`/deals/${deal.id}`);
}

// The owner answers their agent in their own words; the agent then carries on.
export async function replyToAgent(roomId: string, words: string) {
  await applyOwnerReply(roomId, await currentUserId(), words);
  after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
  revalidatePath("/deals", "layout");
}
