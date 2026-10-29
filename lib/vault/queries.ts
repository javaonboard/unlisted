import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Owner's own view of their vault. Includes private fields like minPrice.
export async function listVault(ownerId: string) {
  return db
    .select()
    .from(schema.vaultItems)
    .where(eq(schema.vaultItems.ownerId, ownerId))
    .orderBy(desc(schema.vaultItems.createdAt));
}
