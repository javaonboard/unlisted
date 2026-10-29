import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function listNotifications(userId: string) {
  return db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt));
}
