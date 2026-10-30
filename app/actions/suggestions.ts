"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { acceptSuggestion, dismissSuggestion } from "@/lib/suggestions/accept";

export async function acceptSuggestionAction(id: string) {
  const next = await acceptSuggestion(id, await currentUserId());
  revalidatePath("/", "layout");
  if (next) redirect(next);
}

export async function dismissSuggestionAction(id: string) {
  await dismissSuggestion(id, await currentUserId());
  revalidatePath("/");
}
