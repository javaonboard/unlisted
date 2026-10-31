"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { analyzePhoto } from "@/lib/vault/photo";
import { addVaultItem, setPhoto } from "@/lib/vault/mutations";
import { skillDemand } from "@/lib/vault/demand";
import { understandText } from "@/lib/vault/understand";
import { missing, type Card } from "@/lib/vault/card";
import { addFreeTime } from "@/lib/availability";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { postNeed } from "@/lib/intents/mutations";
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

// What the owner typed, turned into cards to check. Nothing is saved yet.
export async function understandAction(text: string): Promise<{ cards: Card[]; question: string | null; error: string | null }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  try {
    return { ...(await understandText(text, ip)), error: null };
  } catch (error) {
    return { cards: [], question: null, error: error instanceof AiLimitError ? error.message : "Your agent couldn't follow that. Try saying it another way." };
  }
}

export async function saveCards(cards: Card[], said: string) {
  if (cards.some((c) => missing(c).length)) throw new Error("Some must-haves are still missing.");
  const userId = await currentUserId();
  await db.insert(schema.notifications).values({ userId, title: "", body: said, fromMe: true });
  for (const c of cards) {
    if (c.kind === "need") {
      const text = c.details ? `${c.title}. ${c.details}` : c.title;
      await postNeed(userId, { type: c.needType ?? "buy", text, category: c.category, maxPrice: c.maxPrice ?? undefined, dueInDays: c.dueInDays ?? undefined, maxMiles: c.maxMiles ?? undefined });
    } else {
      await addVaultItem(userId, {
        kind: c.kind,
        title: c.title,
        category: c.category,
        condition: c.condition ?? undefined,
        estimatedValue: c.value ?? undefined,
        minPrice: c.kind === "goods" ? (c.minPrice ?? undefined) : (c.value ?? undefined),
        details: c.details ? { notes: c.details } : {},
        maxMiles: c.maxMiles ?? undefined,
      });
      for (const h of c.freeHours) await addFreeTime(userId, new Date(h.start), new Date(h.end));
    }
  }
  const lines = cards.map((c) =>
    c.kind === "need" ? `I'm looking for “${c.title}” for up to $${c.maxPrice}.`
    : c.kind === "goods" ? `Added your ${c.title.toLowerCase()}. It stays private until someone wants it.`
    : `Added ${c.title.toLowerCase()} at $${c.value} a job. I'll tell you when neighbors need it.`,
  );
  await notify(userId, "Got it", lines.join(" "));
  revalidatePath("/", "layout");
}
