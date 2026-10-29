import { db, schema } from ".";

type Activity = typeof schema.activity.$inferInsert;

// Adds an entry to the activity log. PayPal events are saved only once.
export async function logActivity(entry: Activity) {
  await db.insert(schema.activity).values(entry).onConflictDoNothing();
}
