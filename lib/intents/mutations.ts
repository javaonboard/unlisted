import { db, schema } from "@/lib/db";
import { publish } from "@/lib/events/bus";

type NewNeed = {
  type: "buy" | "request_service";
  text: string;
  category: string;
  maxPrice?: number;
  dueInDays?: number;
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
      dueAt: need.dueInDays ? new Date(Date.now() + need.dueInDays * 86_400_000) : null,
    })
    .returning();
  await publish("need.posted", { needId: row.id });
  return row;
}
