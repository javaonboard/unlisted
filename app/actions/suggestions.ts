"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { acceptSuggestion, dismissSuggestion } from "@/lib/suggestions/accept";
import type { PlanPick } from "@/lib/suggestions/accept";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { suggestPlan } from "@/lib/suggestions/plan";

export async function acceptSuggestionAction(id: string) {
  const next = await acceptSuggestion(id, await currentUserId());
  revalidatePath("/", "layout");
  if (next) redirect(next);
}

// "Change the plan": the owner's own pick of what goes in.
export async function acceptPlanAction(id: string, plan: PlanPick) {
  const next = await acceptSuggestion(id, await currentUserId(), plan);
  revalidatePath("/", "layout");
  if (next) redirect(next);
}

export async function dismissSuggestionAction(id: string) {
  await dismissSuggestion(id, await currentUserId());
  revalidatePath("/");
}

// "Tell your agent what to change": the planning agent re-plans from the owner's own words.
export async function replanAction(id: string, words: string) {
  const userId = await currentUserId();
  const [s] = await db.select().from(schema.suggestions).where(and(eq(schema.suggestions.id, id), eq(schema.suggestions.userId, userId), eq(schema.suggestions.kind, "plan")));
  if (s && words.trim()) await suggestPlan(userId, words.trim());
  revalidatePath("/", "layout");
}
