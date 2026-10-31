import { db, schema } from "@/lib/db";

// A message from someone's agent in their inbox. With a room, the inbox also shows that deal's next step.
export async function notify(userId: string, title: string, body: string, roomId?: string | null) {
  await db.insert(schema.notifications).values({ userId, title, body, roomId: roomId ?? null, link: roomId ? `/rooms/${roomId}` : null });
}
