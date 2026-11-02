import { and, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getRoomView } from "@/lib/views/queries";
import { nextFor } from "@/lib/views/next";

// Everything waiting on this person: deal steps and unanswered suggestions.
export async function needsYou(userId: string) {
  const plans = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.ownerId, userId));
  const mine = or(
    eq(schema.negotiations.buyerId, userId),
    eq(schema.negotiations.sellerId, userId),
    plans.length ? inArray(schema.negotiations.dealId, plans.map((p) => p.id)) : undefined,
  );
  const rooms = await db
    .select({ id: schema.negotiations.id })
    .from(schema.negotiations)
    .where(and(mine, inArray(schema.negotiations.status, ["agreed", "waiting_owner"])));

  const roomIds: string[] = [];
  for (const { id } of rooms) {
    const data = await getRoomView(id, userId);
    if (data && nextFor(data, userId).state === "needs_you") roomIds.push(id);
  }
  const suggestions = await db
    .select({ id: schema.suggestions.id })
    .from(schema.suggestions)
    .where(and(eq(schema.suggestions.userId, userId), eq(schema.suggestions.status, "new")));
  return { roomIds, suggestionIds: suggestions.map((s) => s.id), count: roomIds.length + suggestions.length };
}
