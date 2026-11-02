import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// How much nearby demand there is for a skill: open requests and a typical price.
export async function skillDemand(category: string, ownerId: string) {
  const requests = (
    await db.select().from(schema.intents).where(and(eq(schema.intents.category, category), eq(schema.intents.type, "request_service"), eq(schema.intents.status, "open")))
  ).filter((r) => r.ownerId !== ownerId);
  const prices = requests.map((r) => Number(r.maxPrice)).filter(Boolean);
  const perJob = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  return { requests: requests.length, perJob };
}
