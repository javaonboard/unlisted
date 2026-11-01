import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { checkPrice } from "./check";

const areaOf = async (userId: string) => (await db.select({ area: schema.users.area }).from(schema.users).where(eq(schema.users.id, userId)))[0]?.area ?? "Austin";

// Checks what an item or service is worth and keeps the advice on it. The owner's own price stays theirs.
export async function priceItem(itemId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
  if (!item) return null;
  const seen = item.inspection?.matches ? `; photo check: ${item.inspection.grade}${item.inspection.wear.length ? `, ${item.inspection.wear.join(", ")}` : ""}${item.inspection.needsWorking && !item.inspection.workingShown ? ", not shown working" : ""}` : "";
  const check = await checkPrice({ title: item.title, condition: `${item.condition ?? ""}${seen}` || null, category: item.category, kind: item.kind === "skill" ? "service" : "goods", area: await areaOf(item.ownerId) });
  if (!check) return null;
  await db.update(schema.vaultItems).set({ priceCheck: check, estimatedValue: item.estimatedValue ?? check.suggested.toFixed(2) }).where(eq(schema.vaultItems.id, itemId));
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
