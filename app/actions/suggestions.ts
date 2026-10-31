"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { acceptSuggestion, dismissSuggestion } from "@/lib/suggestions/accept";
import type { PlanChoice } from "@/lib/deals/planner";

export async function acceptSuggestionAction(id: string) {
  const next = await acceptSuggestion(id, await currentUserId());
  revalidatePath("/", "layout");
  if (next) redirect(next);
}

// "Change the plan": the owner's own pick of what goes in.
export async function acceptPlanAction(id: string, plan: Partial<PlanChoice>) {
  const next = await acceptSuggestion(id, await currentUserId(), plan);
  revalidatePath("/", "layout");
  if (next) redirect(next);
}

export async function dismissSuggestionAction(id: string) {
  await dismissSuggestion(id, await currentUserId());
  revalidatePath("/");
}
