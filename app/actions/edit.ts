"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { updateItem } from "@/lib/vault/mutations";
import { updateNeed } from "@/lib/intents/mutations";
import { priceItem, priceNeed } from "@/lib/pricing/save";
import { goPrivate, goPublic } from "@/lib/vault/visibility";
import { playLater } from "@/lib/negotiation/start";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : Number(v));
const refresh = () => revalidatePath("/", "layout");

export async function updateItemAction(itemId: string, form: FormData) {
  const userId = await currentUserId();
  const [before] = await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.id, itemId), eq(schema.vaultItems.ownerId, userId)));
  await updateItem(userId, itemId, {
    title: String(form.get("title") ?? "").trim(),
    condition: String(form.get("condition") ?? "").trim(),
    estimatedValue: num(form.get("estimatedValue")),
    minPrice: num(form.get("minPrice")),
    openToOffers: form.get("openToOffers") === "on",
    ...(before?.kind === "goods"
      ? { forSale: form.get("forSale") === "on", rentPerDay: num(form.get("rentPerDay")) ?? null, deposit: num(form.get("deposit")) ?? null }
      : {}),
  });
  if (before && !before.openToOffers && form.get("openToOffers") === "on") playLater(await goPublic(userId, itemId)); // same as the one-click switch
  refresh();
}

export async function updateNeedAction(needId: string, form: FormData) {
  const due = String(form.get("dueAt") ?? "");
  await updateNeed(await currentUserId(), needId, { text: String(form.get("text") ?? "").trim(), maxPrice: num(form.get("maxPrice")), dueAt: due ? new Date(`${due}T18:00:00`) : undefined });
  refresh();
}

// Only the owner can ask for a price check on their own things.
export async function checkItemPriceAction(itemId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.id, itemId), eq(schema.vaultItems.ownerId, await currentUserId())));
  if (item) await priceItem(itemId);
  refresh();
}

export async function checkNeedPriceAction(needId: string) {
  const [need] = await db.select().from(schema.intents).where(and(eq(schema.intents.id, needId), eq(schema.intents.ownerId, await currentUserId())));
  if (need) await priceNeed(needId);
  refresh();
}

// "Use it": the advice becomes the owner's price or budget.
export async function useItemPriceAction(itemId: string) {
  const userId = await currentUserId();
  const [item] = await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.id, itemId), eq(schema.vaultItems.ownerId, userId)));
  if (item?.priceCheck) await updateItem(userId, itemId, { condition: item.condition ?? "", estimatedValue: item.priceCheck.suggested });
  refresh();
}

export async function useNeedBudgetAction(needId: string) {
  const userId = await currentUserId();
  const [need] = await db.select().from(schema.intents).where(and(eq(schema.intents.id, needId), eq(schema.intents.ownerId, userId)));
  if (need?.priceCheck) await updateNeed(userId, needId, { maxPrice: need.priceCheck.suggested });
  refresh();
}

// Sell, rent out, or both. Renting needs a day price and a deposit: a starting point from its value, editable on the item page.
export async function setWaysAction(itemId: string, ways: "sell" | "rent" | "both") {
  const userId = await currentUserId();
  const [item] = await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.id, itemId), eq(schema.vaultItems.ownerId, userId)));
  if (!item || item.kind !== "goods") return;
  const value = Number(item.estimatedValue ?? 0);
  const renting = ways !== "sell";
  await updateItem(userId, itemId, {
    condition: item.condition ?? "",
    forSale: ways !== "rent",
    rentPerDay: renting ? Number(item.rentPerDay ?? Math.max(5, Math.round(value * 0.04))) : null,
    deposit: renting ? Number(item.deposit ?? Math.round(value * 0.5)) : null,
  });
  refresh();
}

// One click on My stuff: public starts talks with the best matches, private stops new ones.
// It says which state it wants, so a double click can't flip it back.
export async function setVisibilityAction(itemId: string, open: boolean) {
  const userId = await currentUserId();
  if (open) playLater(await goPublic(userId, itemId));
  else await goPrivate(userId, itemId);
  refresh();
}
