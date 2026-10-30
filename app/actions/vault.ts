"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { analyzePhoto } from "@/lib/vault/photo";
import { addVaultItem, setPhoto } from "@/lib/vault/mutations";
import { skillDemand } from "@/lib/vault/demand";
import { AiLimitError } from "@/lib/ai/limits";

export type Suggestion = {
  kind: "goods" | "skill";
  title: string;
  category: string;
  note: string; // condition for goods, the reason for skills
  value: number | null;
  demand?: { requests: number; perJob: number | null };
};

// Turns one photo into suggested vault cards. Nothing is saved yet.
export async function suggestFromPhoto(base64: string): Promise<{ suggestions: Suggestion[]; error: string | null }> {
  const userId = await currentUserId();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  try {
    const result = await analyzePhoto(base64, "image/jpeg", ip);
    const goods: Suggestion[] = result.goods.map((g) => ({ kind: "goods", title: g.title, category: g.category, note: g.condition, value: g.usedValue }));
    const skills: Suggestion[] = await Promise.all(
      result.skills.map(async (s) => ({ kind: "skill" as const, title: s.title, category: s.category, note: s.because, value: null, demand: await skillDemand(s.category, userId) })),
    );
    return { suggestions: [...goods, ...skills], error: null };
  } catch (error) {
    return { suggestions: [], error: error instanceof AiLimitError ? error.message : "Couldn't read that photo. Try another one." };
  }
}

export async function addSuggestions(picked: Suggestion[], thumbnail: string) {
  const userId = await currentUserId();
  for (const s of picked) {
    const item = await addVaultItem(userId, {
      kind: s.kind,
      title: s.title,
      category: s.category,
      condition: s.kind === "goods" ? s.note : undefined,
      estimatedValue: s.value ?? s.demand?.perJob ?? undefined,
    });
    if (s.kind === "goods") await setPhoto(item.id, thumbnail);
  }
  revalidatePath("/vault");
}
