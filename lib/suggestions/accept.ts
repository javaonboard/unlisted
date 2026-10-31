import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addVaultItem } from "@/lib/vault/mutations";
import { postNeed } from "@/lib/intents/mutations";
import { startNegotiation } from "@/lib/negotiation/start";
import { onDismissed, runWave } from "./engine";
import { startLinkedDeal } from "@/lib/deals/planner";
import { goPublic } from "@/lib/vault/visibility";
import { playLater } from "@/lib/negotiation/start";

export type PlanPick = { partIds?: string[]; sellOnlyIfBought?: boolean };

// "Yes" on a suggestion. Returns where to go next, if anywhere.
// A plan can come with the owner's own choices ("Change the plan").
export async function acceptSuggestion(id: string, userId: string, plan?: PlanPick): Promise<string | null> {
  const [s] = await db.select().from(schema.suggestions).where(eq(schema.suggestions.id, id));
  if (!s || s.userId !== userId || s.status !== "new") return null;
  await db.update(schema.suggestions).set({ status: "accepted" }).where(eq(schema.suggestions.id, id));
  const a = s.action;

  const talk = async (itemId: string, needId: string) => {
    const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, needId));
    const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
    // The person with the need buys; the item or skill owner sells or serves.
    const room = await startNegotiation({ buyerId: need.ownerId, sellerId: item.ownerId, itemId, intentId: needId });
    return `/rooms/${room.id}`;
  };

  switch (s.kind) {
    case "open_item":
      await db.update(schema.vaultItems).set({ openToOffers: true }).where(eq(schema.vaultItems.id, String(a.itemId)));
      return talk(String(a.itemId), String(a.needId));
    case "offer_skill":
      await db.update(schema.vaultItems).set({ openToOffers: true }).where(eq(schema.vaultItems.id, String(a.itemId)));
      return talk(String(a.itemId), String(a.needId));
    case "add_skill": {
      const skill = await addVaultItem(userId, { kind: "skill", title: String(a.skill), category: String(a.category), estimatedValue: Number(a.value) || undefined, openToOffers: true });
      return talk(skill.id, String(a.needId));
    }
    case "raise_offer":
      await db.update(schema.intents).set({ maxPrice: Number(a.maxPrice).toFixed(2), wave: 0 }).where(eq(schema.intents.id, String(a.needId)));
      await runWave(String(a.needId), 1);
      return `/needs/${a.needId}`;
    case "go_public": {
      playLater(await goPublic(userId, String(a.itemId)));
      return `/my-stuff/${a.itemId}`;
    }
    case "plan": {
      // The agent's plan, or the owner's own pick of its parts ("Change the plan").
      const parts = JSON.parse(String(a.parts)) as { kind: string; id: string; itemId?: string }[];
      const chosen = plan?.partIds ? parts.filter((p) => plan.partIds!.includes(p.id)) : parts;
      const deal = await startLinkedDeal(userId, {
        title: String(a.title),
        sells: chosen.filter((p) => p.kind === "sell").map((p) => ({ needId: p.id, itemId: p.itemId! })),
        buyIds: chosen.filter((p) => p.kind === "buy").map((p) => p.id),
        helperIds: chosen.filter((p) => p.kind === "helper").map((p) => p.id),
        sellOnlyIfBought: plan?.sellOnlyIfBought ?? Boolean(a.sellWaitsForBuy),
      });
      await db.insert(schema.notifications).values({ userId, title: `${deal.title}: started`, body: "My agents are talking to the best matches. Each part shows up here as its own deal when it needs you.", link: `/deals/${deal.id}` });
      return "/";
    }
    case "post_need": {
      // The suggestion said the budget out loud, so "Yes" agrees to it.
      const need = await postNeed(userId, { type: a.type as "buy" | "request_service", text: String(a.text), category: String(a.category), maxPrice: a.maxPrice ? Number(a.maxPrice) : undefined, dueInDays: 7, constraints: a.constraints ? JSON.parse(String(a.constraints)) : undefined });
      return `/needs/${need.id}`;
    }
  }
}

export async function dismissSuggestion(id: string, userId: string) {
  const [s] = await db.select().from(schema.suggestions).where(eq(schema.suggestions.id, id));
  if (!s || s.userId !== userId) return;
  await db.update(schema.suggestions).set({ status: "dismissed" }).where(eq(schema.suggestions.id, id));
  if (s.needId) await onDismissed(s.needId, s.wave);
}
