import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Owner's own view of their things. Includes private fields like minPrice.
export async function listItems(ownerId: string) {
  return db
    .select()
    .from(schema.items)
    .where(eq(schema.items.ownerId, ownerId))
    .orderBy(desc(schema.items.createdAt));
}
