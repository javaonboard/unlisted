import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { firstName, logActivity } from "@/lib/db/activity";
import { endTalks, hasOpenDeal } from "@/lib/negotiation/end";
import { backOnTheMarket } from "@/lib/deals/backout";

// The owner doesn't need it any more. Agents stop looking, talks end, and suggestions about it go.
export async function removeNeed(ownerId: string, needId: string) {
  if (await hasOpenDeal({ intentId: needId })) return { error: "There's an agreed deal for it. Finish it or back out first." };
  const [need] = await db
    .update(schema.intents)
    .set({ status: "removed" })
    .where(and(eq(schema.intents.id, needId), eq(schema.intents.ownerId, ownerId), eq(schema.intents.status, "open")))
    .returning();
  if (!need) return { error: null };

  const first = await firstName(ownerId);
  console.log("[need] removed", needId);
  await logActivity({ userId: ownerId, type: "item", message: `Removed “${need.text}”`, data: { needId } });
  await db.update(schema.suggestions).set({ status: "expired" }).where(and(eq(schema.suggestions.status, "new"), eq(schema.suggestions.needId, needId)));
  const closed = await endTalks({ intentId: needId }, ownerId, "doesn't need it any more", `${first} doesn't need it any more`, "Those talks ended. I'll look for someone else.");
  return { error: null, carryOn: async () => { for (const room of closed) await backOnTheMarket(room, ownerId); } };
}
