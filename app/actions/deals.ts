"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { applyOwnerReply, askForNewTime } from "@/lib/negotiation/owner";
import { acceptDeal } from "@/lib/deals/accept";
import { nudge } from "@/lib/deals/nudge";
import { onPlanChanged } from "@/lib/plans/cascade";
import { backOnTheMarket, backOut, type Reason } from "@/lib/deals/backout";
import { answerProblem, reportProblem } from "@/lib/payments/problems";
import { changeMeetAt, type MeetAt } from "@/lib/deals/meet";
import { playRoom } from "@/lib/negotiation/room";

// The owner answers their agent in their own words; the agent then carries on.
export async function replyToAgent(roomId: string, words: string) {
  await applyOwnerReply(roomId, await currentUserId(), words);
  after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
  revalidatePath("/", "layout");
}

export async function acceptDealAction(roomId: string) {
  await acceptDeal(roomId, await currentUserId());
  revalidatePath("/", "layout");
}

// Ask for another time in your own words; the agents settle it.
export async function changeTimeAction(roomId: string, words: string) {
  await askForNewTime(roomId, await currentUserId(), words);
  after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
  revalidatePath("/", "layout");
}

export async function changeMeetAtAction(roomId: string, meetAt: MeetAt) {
  await changeMeetAt(roomId, await currentUserId(), meetAt);
  // In a plan, a new place can change a helper's stops or the order of handoffs: the plan agent adjusts.
  after(async () => {
    const rooms = await onPlanChanged(roomId);
    for (const r of rooms) await playRoom(r.id);
  });
  revalidatePath("/", "layout");
}

export async function nudgeAction(roomId: string) {
  return nudge(roomId, await currentUserId());
}

// Back out of a deal with a reason. The item or need goes back on the market after the response.
export async function backOutAction(roomId: string, reason: Reason, note: string) {
  const userId = await currentUserId();
  const result = await backOut(roomId, userId, reason, note);
  if (result.room) {
    const room = result.room;
    after(() => backOnTheMarket(room, userId).catch((e) => console.error("[backout] failed", e?.message)));
  }
  revalidatePath("/", "layout");
  return result.error;
}

export async function reportProblemAction(legId: string, note: string, refund: number) {
  const error = await reportProblem(legId, await currentUserId(), note, refund);
  revalidatePath("/", "layout");
  return error;
}

export async function answerProblemAction(legId: string, agree: boolean) {
  await answerProblem(legId, await currentUserId(), agree);
  revalidatePath("/", "layout");
}
