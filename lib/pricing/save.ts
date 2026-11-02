import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { checkPrice } from "./check";
import { notify } from "@/lib/notifications/notify";
import { inSentence } from "@/lib/text/words";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const areaOf = async (userId: string) => (await db.select({ area: schema.users.area }).from(schema.users).where(eq(schema.users.id, userId)))[0]?.area ?? "Austin";

// Checks what an item or service is worth and keeps the advice on it. The owner's own price stays theirs.
export async function priceItem(itemId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
  if (!item) return null;
  const seen = item.inspection?.matches ? `; photo check: ${item.inspection.grade}${item.inspection.wear.length ? `, ${item.inspection.wear.join(", ")}` : ""}${item.inspection.needsWorking && !item.inspection.workingShown ? ", not shown working" : ""}` : "";
  const check = await checkPrice({ title: item.title, condition: `${item.condition ?? ""}${seen}` || null, category: item.category, kind: item.kind === "skill" ? "service" : "goods", area: await areaOf(item.ownerId) });
  if (!check) return null;
  // The owner's own price stays. A first guess from a photo gives way to the market check.
  const guess = item.priceIsGuess || !item.estimatedValue;
  await db
    .update(schema.vaultItems)
    .set({ priceCheck: check, ...(guess ? { estimatedValue: check.suggested.toFixed(2), priceIsGuess: false } : {}) })
    .where(eq(schema.vaultItems.id, itemId));
  const before = Number(item.estimatedValue ?? 0);
  if (item.priceIsGuess && before && Math.abs(check.suggested - before) / before > 0.15) {
    await notify(item.ownerId, `New price for your ${inSentence(item.title)}`, `I checked the market: about ${usd(check.suggested)}. My first guess from the photo was ${usd(before)}, so I updated it. Change it anytime.`);
  }
  return check;
}

// What's a fair budget for a need.
export async function priceNeed(needId: string) {
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, needId));
  if (!need) return null;
  const check = await checkPrice({ title: need.text, category: need.category, kind: need.type === "request_service" ? "service" : "budget", area: await areaOf(need.ownerId) });
  if (check) await db.update(schema.intents).set({ priceCheck: check }).where(eq(schema.intents.id, needId));
  return check;
}
