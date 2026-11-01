"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { analyzePhoto } from "@/lib/vault/photo";
import { addVaultItem, setPhoto } from "@/lib/vault/mutations";
import { skillDemand } from "@/lib/vault/demand";
import { understandText } from "@/lib/vault/understand";
import { asRecord, missing, type Card } from "@/lib/vault/card";
import { addFreeTime } from "@/lib/availability";
import { db, schema } from "@/lib/db";
import { once } from "@/lib/db/once";
import { notify } from "@/lib/notifications/notify";
import { postNeed } from "@/lib/intents/mutations";
import { AiLimitError } from "@/lib/ai/limits";
import { inSentence } from "@/lib/text/words";

export type Suggestion = {
  kind: "goods" | "skill";
  title: string;
  category: string;
  note: string; // condition for goods, the reason for skills
  value: number | null;
  demand?: { requests: number; perJob: number | null };
  specs?: Record<string, number>;
  ways?: ("sell" | "rent")[];
  rentPerDay?: number | null;
};

// Turns one photo into suggested vault cards. Nothing is saved yet.
export async function suggestFromPhoto(base64: string): Promise<{ suggestions: Suggestion[]; error: string | null }> {
  const userId = await currentUserId();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  try {
    const result = await analyzePhoto(base64, "image/jpeg", ip);
    const goods: Suggestion[] = result.goods.map((g) => ({ kind: "goods", title: g.title, category: g.category, note: g.condition, value: g.usedValue, specs: asRecord(g.specs), ways: g.ways, rentPerDay: g.rentPerDay }));
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
      details: s.specs ?? {},
      forSale: s.kind === "goods" ? !s.ways?.length || s.ways.includes("sell") : undefined,
      rentPerDay: s.ways?.includes("rent") ? (s.rentPerDay ?? undefined) : undefined,
      deposit: s.ways?.includes("rent") && s.value ? Math.round(s.value * 0.5) : undefined, // half its value, editable
    });
    if (s.kind === "goods") await setPhoto(item.id, thumbnail);
  }
  revalidatePath("/my-stuff");
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

export async function saveCards(cards: Card[], said: string, key: string) {
  if (cards.some((c) => missing(c).length)) throw new Error("Some must-haves are still missing.");
  const userId = await currentUserId();
  if (!(await once(`save:${userId}:${key}`))) return; // a second click on the same Save does nothing
  await db.insert(schema.notifications).values({ userId, title: "", body: said, fromMe: true });
  for (const c of cards) {
    if (c.kind === "need") {
      const text = c.details ? `${c.title}. ${c.details}` : c.title;
      await postNeed(userId, { type: c.needType ?? "buy", text, category: c.category, maxPrice: c.maxPrice ?? undefined, dueInDays: c.dueInDays ?? undefined, maxMiles: c.maxMiles ?? undefined, constraints: asRecord(c.requirements), days: c.days ?? undefined });
    } else {
      await addVaultItem(userId, {
        kind: c.kind,
        title: c.title,
        category: c.category,
        condition: c.condition ?? undefined,
        estimatedValue: c.value ?? undefined,
        minPrice: c.kind === "goods" ? (c.minPrice ?? undefined) : (c.value ?? undefined),
        details: { ...(c.details ? { notes: c.details } : {}), ...asRecord(c.specs) },
        maxMiles: c.maxMiles ?? undefined,
        forSale: c.kind === "goods" ? (c.ways?.length ? c.ways.includes("sell") : true) : undefined,
        rentPerDay: c.ways?.includes("rent") ? (c.rentPerDay ?? undefined) : undefined,
        deposit: c.ways?.includes("rent") ? (c.deposit ?? undefined) : undefined,
      });
      for (const h of c.freeHours) await addFreeTime(userId, new Date(h.start), new Date(h.end));
    }
  }
  const lines = cards.map((c) =>
    c.kind === "need" ? `I'm looking for “${c.title}”${c.needType === "rent" ? ` to rent for ${c.days} day${c.days === 1 ? "" : "s"}` : ""} for up to $${c.maxPrice}.`
    : c.kind === "goods" ? `Added your ${inSentence(c.title)}. It stays private until someone wants it.`
    : `Added ${inSentence(c.title)} at $${c.value} a job. I'll tell you when neighbors need it.`,
  );
  await notify(userId, "Got it", lines.join(" "));
  revalidatePath("/", "layout");
}
