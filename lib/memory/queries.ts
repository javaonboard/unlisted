import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function listFacts(userId: string) {
  return db.select().from(schema.memoryFacts).where(eq(schema.memoryFacts.userId, userId)).orderBy(desc(schema.memoryFacts.createdAt));
}

// Owners can only change their own facts.
const own = (id: string, userId: string) => and(eq(schema.memoryFacts.id, id), eq(schema.memoryFacts.userId, userId));

export async function editFact(id: string, userId: string, fact: string) {
  await db.update(schema.memoryFacts).set({ fact, verified: true, confidence: 1, source: "you" }).where(own(id, userId));
}

export async function confirmFact(id: string, userId: string) {
  await db.update(schema.memoryFacts).set({ verified: true, confidence: 1 }).where(own(id, userId));
}

export async function deleteFact(id: string, userId: string) {
  await db.delete(schema.memoryFacts).where(own(id, userId));
}
