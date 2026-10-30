import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const PER_DAY = 10;
type NewSuggestion = typeof schema.suggestions.$inferInsert;

// Adds a suggestion unless the person already has today's ten, or this exact one.
export async function suggest(s: NewSuggestion) {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const today = await db
    .select()
    .from(schema.suggestions)
    .where(and(eq(schema.suggestions.userId, s.userId), gte(schema.suggestions.createdAt, dayAgo)));
  if (today.length >= PER_DAY) return false;
  if (today.some((t) => t.kind === s.kind && t.needId === (s.needId ?? null) && t.title === s.title)) return false;

  await db.insert(schema.suggestions).values(s);
  console.log(`[suggest] ${s.userId}: ${s.title}`);
  return true;
}
