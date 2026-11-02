import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";

// Which people's things would let them do this job? A ladder could mean gutter cleaning,
// a truck could mean moving help. The agent judges; code keeps only real item ids.
export async function toolOwnersFor(need: { id: string; ownerId: string; text: string; category: string }) {
  const items = await db
    .select({ id: schema.items.id, ownerId: schema.items.ownerId, title: schema.items.title })
    .from(schema.items)
    .where(and(eq(schema.items.kind, "goods"), ne(schema.items.ownerId, need.ownerId)))
    .limit(80);
  if (!items.length) return [];

  const { matches } = await askForData({
    schema: z.object({
      matches: z.array(z.object({
        itemId: z.string(),
        skill: z.string().describe("The service its owner could offer, e.g. 'Gutter cleaning'"),
      })),
    }),
    model: MODELS.small,
    content: `Someone nearby needs: "${need.text}".
Which of these things would clearly let their owner do that job for them? Only obvious fits.
${items.map((i) => `- ${i.id}: ${i.title}`).join("\n")}`,
  });
  return matches.flatMap((m) => {
    const item = items.find((i) => i.id === m.itemId);
    return item ? [{ ...item, skill: m.skill }] : [];
  });
}
