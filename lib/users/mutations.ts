import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// The private street address. Only the other person in a paid-into-hold deal ever sees it.
export async function setAddress(userId: string, address: string) {
  await db.update(schema.users).set({ address: address.trim() || null }).where(eq(schema.users.id, userId));
}

// Where their payouts go. Only their own PayPal account; changing it never moves money already sent.
export async function setPaypalEmail(userId: string, email: string) {
  const clean = email.trim().toLowerCase();
  if (clean && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return "That doesn't look like an email.";
  await db.update(schema.users).set({ paypalEmail: clean || null }).where(eq(schema.users.id, userId));
  return null;
}
