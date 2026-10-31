import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { publish } from "@/lib/events/bus";

type NewNeed = {
  type: "buy" | "request_service";
  text: string;
  category: string;
  maxPrice?: number;
  dueInDays?: number;
  maxMiles?: number;
  constraints?: Record<string, number>; // e.g. { minSeats: 3, maxWidthIn: 80 }
};

export async function postNeed(ownerId: string, need: NewNeed) {
  const [row] = await db
    .insert(schema.intents)
    .values({
      ownerId,
      type: need.type,
      text: need.text,
      category: need.category,
      maxPrice: need.maxPrice?.toFixed(2),
      maxMiles: need.maxMiles,
      constraints: need.constraints ?? {},
      dueAt: need.dueInDays != null ? new Date(Date.now() + Math.max(1, need.dueInDays) * 86_400_000) : null,
    })
    .returning();
  await publish("need.posted", { needId: row.id });
  return row;
}

// How far away is fine for this need. Only the owner can change it.
export async function setNeedRange(ownerId: string, needId: string, miles: number) {
  await db.update(schema.intents).set({ maxMiles: Math.max(1, Math.round(miles)) }).where(and(eq(schema.intents.id, needId), eq(schema.intents.ownerId, ownerId)));
}

// The owner edits their need: wording, budget, deadline.
export async function updateNeed(ownerId: string, needId: string, f: { text?: string; maxPrice?: number; dueAt?: Date }) {
  await db
    .update(schema.intents)
    .set({
      ...(f.text ? { text: f.text } : {}),
      ...(f.maxPrice !== undefined ? { maxPrice: f.maxPrice.toFixed(2) } : {}),
      ...(f.dueAt ? { dueAt: f.dueAt } : {}),
    })
    .where(and(eq(schema.intents.id, needId), eq(schema.intents.ownerId, ownerId)));
}
