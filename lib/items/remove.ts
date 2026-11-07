import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { firstName, logActivity } from "@/lib/db/activity";
import { endTalks, hasOpenDeal } from "@/lib/negotiation/end";
import { backOnTheMarket } from "@/lib/deals/backout";
import { inSentence } from "@/lib/text/words";

// The owner takes something off. It's hidden from every agent, talks end, and suggestions about it go.
// The row stays, so old chats and receipts still work.
export async function removeItem(ownerId: string, itemId: string) {
  if (await hasOpenDeal({ itemId })) return { error: "There's an agreed deal on it. Finish it or back out first." };
  const [item] = await db
    .update(schema.items)
    .set({ removedAt: new Date(), openToOffers: false })
    .where(and(eq(schema.items.id, itemId), eq(schema.items.ownerId, ownerId), isNull(schema.items.removedAt)))
    .returning();
  if (!item) return { error: null }; // already removed: a second click does nothing

  const what = inSentence(item.title);
  const first = await firstName(ownerId);
  console.log("[item] removed", itemId);
  await logActivity({ userId: ownerId, type: "item", message: `Removed ${item.title}`, data: { itemId } });
  await db.update(schema.suggestions).set({ status: "expired" }).where(and(eq(schema.suggestions.status, "new"), sql`${schema.suggestions.action}->>'itemId' = ${itemId}`));
  const closed = await endTalks({ itemId }, ownerId, "took it off the market", `${first} took the ${what} off the market`, "Those talks ended. I'll keep looking for you.");
  return { error: null, carryOn: async () => { for (const room of closed) await backOnTheMarket(room, ownerId); } };
}
