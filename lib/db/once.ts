import { db, schema } from "@/lib/db";

// True the first time a key is seen, false after. For clicks that must only count once.
export async function once(key: string) {
  const rows = await db.insert(schema.actionKeys).values({ key }).onConflictDoNothing().returning();
  return rows.length > 0;
}
