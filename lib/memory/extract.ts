import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";

const NewFacts = z.object({
  facts: z
    .array(z.object({ fact: z.string().describe("At most 12 words, plain, like 'Flexible on price when the buyer meets them halfway.'"), confidence: z.number().describe("0 to 1") }))
    .describe("At most two facts that are new, useful for future deals, and not already known. Empty if nothing new."),
});

// After a finished negotiation, keep what it taught us about one owner.
export async function learnFromRoom(roomId: string, ownerId: string) {
  if (ownerId.startsWith("guest-")) return;
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  const moves = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(asc(schema.offers.createdAt));
  const known = await db.select().from(schema.memoryFacts).where(eq(schema.memoryFacts.userId, ownerId));

  // Only this owner's side: their agent's moves and their own notes.
  const story = moves
    .filter((m) => m.fromUserId === ownerId)
    .map((m) => `${m.kind}${m.price ? ` $${m.price}` : ""}: ${m.kind === "owner_note" ? `owner said "${m.note}"` : m.reasoning ?? m.note}`)
    .join("\n");

  const { facts } = await askForData({
    schema: NewFacts,
    model: MODELS.small,
    content: `A negotiation ended (${room.status}${room.agreedPrice ? ` at $${room.agreedPrice}` : ""}, ${room.label}).
What the owner's side did:
${story}

Already known about the owner:
${known.map((k) => `- ${k.fact}`).join("\n") || "- nothing"}

List new facts about the owner that would help future deals (timing, pickup, flexibility, what they care about). Never store anything about the other person.`,
  });

  for (const f of facts.slice(0, 2)) {
    await db.insert(schema.memoryFacts).values({
      userId: ownerId,
      fact: f.fact,
      source: `deal: ${room.label ?? "negotiation"}`,
      confidence: Math.max(0, Math.min(1, f.confidence)),
      verified: false,
    });
  }
  if (facts.length) console.log("[memory] learned", facts.length, "for", ownerId);
}
