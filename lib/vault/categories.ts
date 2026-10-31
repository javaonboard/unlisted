import { db, schema } from "@/lib/db";

// Categories already in use, so the AI files new things under the same names and matching works.
// It can still make a new one when nothing fits.
export async function knownCategories() {
  const [items, needs] = await Promise.all([
    db.selectDistinct({ c: schema.vaultItems.category }).from(schema.vaultItems),
    db.selectDistinct({ c: schema.intents.category }).from(schema.intents),
  ]);
  return [...new Set([...items, ...needs].map((r) => r.c))].sort();
}

export const categoryRule = (known: string[]) =>
  `Category: reuse one of these if it fits (${known.join(", ")}), otherwise a new short lowercase slug.`;
