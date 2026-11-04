import { eq } from "drizzle-orm";
import { db, schema } from ".";

type Activity = typeof schema.activity.$inferInsert;

// Adds an entry to the activity log. PayPal events are saved only once.
export async function logActivity(entry: Activity) {
  await db.insert(schema.activity).values(entry).onConflictDoNothing();
}

// One step in a deal, for its "What happened" list. Written with names, since both people in the deal see it.
export async function logStep(roomId: string | null, userId: string | null, message: string, data: Record<string, unknown> = {}) {
  await logActivity({ userId, type: "deal", message, data: { roomId, ...data } });
}

export async function firstName(userId: string) {
  const [user] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId));
  return user?.name.split(" ")[0] ?? "Someone";
}
