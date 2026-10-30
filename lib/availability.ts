import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Upcoming hours someone marked free.
export async function freeTimes(userId: string) {
  const rows = await db
    .select({ id: schema.freeTimes.id, startsAt: schema.freeTimes.startsAt, endsAt: schema.freeTimes.endsAt })
    .from(schema.freeTimes)
    .where(eq(schema.freeTimes.userId, userId));
  const now = new Date();
  return rows.filter((f) => f.endsAt > now);
}

export async function addFreeTime(userId: string, startsAt: Date, endsAt: Date) {
  if (!(endsAt > startsAt)) return;
  await db.insert(schema.freeTimes).values({ userId, startsAt, endsAt });
}

export async function clearFreeTimes(userId: string) {
  await db.delete(schema.freeTimes).where(eq(schema.freeTimes.userId, userId));
}
