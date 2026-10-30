import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";

const Reply = z.object({
  newLimit: z.number().nullable().describe("A new price limit if the owner gave or allowed one, else null"),
});

// The owner answers their agent in their own words, e.g. "try $200 instead".
// We keep the words for the agent and pull out a new limit if there is one.
export async function applyOwnerReply(roomId: string, ownerId: string, words: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || room.status !== "waiting_owner") return;

  const [question] = (await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)))
    .filter((m) => m.kind === "ask_owner" && m.fromUserId === ownerId)
    .slice(-1);

  const { newLimit } = await askForData({
    schema: Reply,
    model: MODELS.small,
    content: `An agent asked its owner: "${question?.note}" (suggested price: ${question?.price ?? "none"}).
The owner replied: "${words}".
If the reply allows or sets a price, give it as newLimit. "Yes" means the suggested price. Otherwise null.`,
  });

  const side = room.buyerId === ownerId ? "buyer" : "seller";
  await db.insert(schema.offers).values({ negotiationId: roomId, fromUserId: ownerId, round: room.round, kind: "owner_note", note: words });
  await db
    .update(schema.negotiations)
    .set({
      status: "open",
      ...(newLimit !== null && side === "buyer" ? { buyerLimit: newLimit.toFixed(2) } : {}),
      ...(newLimit !== null && side === "seller" ? { sellerLimit: newLimit.toFixed(2) } : {}),
    })
    .where(eq(schema.negotiations.id, roomId));
  console.log(`[room] ${roomId.slice(0, 8)} owner replied: "${words}" → limit ${newLimit ?? "unchanged"}`);
}
