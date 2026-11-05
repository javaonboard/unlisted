import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, pg, schema } from "@/lib/db";

type EventType = "need.posted" | "item.added" | "deal.agreed";
const CHANNEL = "unlisted_events";

// Saves the event, then tells every listener about it right away.
// In production this would be a Kafka topic; the shape stays the same.
export async function publish(type: EventType, payload: Record<string, string>) {
  const [event] = await db.insert(schema.events).values({ type, payload }).returning({ id: schema.events.id });
  await pg.notify(CHANNEL, event.id);
}

type Handler = (type: EventType, payload: Record<string, string>) => Promise<void>;
let handler: Handler | null = null;

// Handles one event once: claimed in one step, so only one server handles it.
async function handleEvent(eventId: string) {
  const [event] = await db
    .update(schema.events)
    .set({ processedAt: new Date() })
    .where(and(eq(schema.events.id, eventId), isNull(schema.events.processedAt)))
    .returning();
  if (!event || !handler) return;
  try {
    await handler(event.type as EventType, event.payload);
  } catch (error) {
    console.error("[events] failed", event.type, (error as Error).message);
  }
}

// Reacts to each event as soon as it is published, and catches up on any that came while no server was listening.
export async function listen(handle: Handler) {
  handler = handle;
  await pg.listen(CHANNEL, handleEvent);
  console.log("[events] listening");
  await catchUp();
}

// Events from the last hour nobody handled yet (published during a restart, a deploy, or by a script).
export async function catchUp() {
  const recent = gt(schema.events.createdAt, new Date(Date.now() - 3_600_000)); // older ones are stale news
  const waiting = await db.select({ id: schema.events.id }).from(schema.events).where(and(isNull(schema.events.processedAt), recent)).orderBy(asc(schema.events.createdAt)).limit(100);
  for (const e of waiting) await handleEvent(e.id);
  if (waiting.length) console.log("[events] caught up on", waiting.length);
}
