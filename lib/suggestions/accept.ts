import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addVaultItem } from "@/lib/vault/mutations";
import { postNeed } from "@/lib/intents/mutations";
import { startNegotiation } from "@/lib/negotiation/start";
import { onDismissed, runWave } from "./engine";
import { startLinkedDeal } from "@/lib/deals/planner";

// "Yes" on a suggestion. Returns where to go next, if anywhere.
export async function acceptSuggestion(id: string, userId: string): Promise<string | null> {
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
    case "plan": {
      const deal = await startLinkedDeal(userId, String(a.title));
      return `/deals/${deal.id}`;
    }
    case "post_need": {
      const need = await postNeed(userId, { type: a.type as "request_service", text: String(a.text), category: String(a.category) });
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
