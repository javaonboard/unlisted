"use server";

import { currentUserId } from "@/lib/session";
import { askAboutMoney } from "@/lib/money/ask";
import { AiLimitError } from "@/lib/ai/limits";

export async function askMoneyAction(question: string): Promise<{ answer: string | null; error: string | null }> {
  try {
    return { answer: await askAboutMoney(await currentUserId(), question), error: null };
  } catch (error) {
    return { answer: null, error: error instanceof AiLimitError ? error.message : "Couldn't check that right now. Try again." };
  }
}
