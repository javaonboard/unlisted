import { eq } from "drizzle-orm";
import { db, pg, schema } from "@/lib/db";

export type EventType = "need.posted" | "vault.added";
const CHANNEL = "unlisted_events";

// Saves the event, then tells every listener about it right away.
// In production this would be a Kafka topic; the shape stays the same.
export async function publish(type: EventType, payload: Record<string, string>) {
  const [event] = await db.insert(schema.events).values({ type, payload }).returning({ id: schema.events.id });
  await pg.notify(CHANNEL, event.id);
}

type Handler = (type: EventType, payload: Record<string, string>) => Promise<void>;

// Reacts to each event once, as soon as it is published.
export async function listen(handle: Handler) {
  await pg.listen(CHANNEL, async (eventId) => {
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
    if (!event || event.processedAt) return;
    await db.update(schema.events).set({ processedAt: new Date() }).where(eq(schema.events.id, eventId));
    try {
      await handle(event.type as EventType, event.payload);
    } catch (error) {
      console.error("[events] failed", event.type, (error as Error).message);
    }
  });
  console.log("[events] listening");
}
