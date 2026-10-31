import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// The private street address. Only the other person in a paid-into-hold deal ever sees it.
export async function setAddress(userId: string, address: string) {
  await db.update(schema.users).set({ address: address.trim() || null }).where(eq(schema.users.id, userId));
}
