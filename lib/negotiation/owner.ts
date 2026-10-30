import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";
import { confirmTime } from "@/lib/bookings";

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

// After a deal, one side wants another time. The room reopens for the time only:
// the price is pinned, the asker counts as confirmed, and the asker's agent moves first.
export async function askForNewTime(roomId: string, ownerId: string, words: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || room.status !== "agreed" || (room.buyerId !== ownerId && room.sellerId !== ownerId)) return;

  await db.update(schema.bookings).set({ confirmedAt: null }).where(eq(schema.bookings.roomId, roomId));
  await confirmTime(roomId, ownerId);

  const price = Number(room.agreedPrice).toFixed(0);
  await db.insert(schema.offers).values({ negotiationId: roomId, fromUserId: ownerId, round: room.round, kind: "owner_note", note: `Change the time: ${words}. Keep the price at $${price}, only the time moves.` });

  // The buyer moves on odd rounds, so skip one if it's the other side's turn.
  const askerIsBuyer = room.buyerId === ownerId;
  const nextIsBuyer = (room.round + 1) % 2 === 1;
  const round = room.round + (askerIsBuyer === nextIsBuyer ? 0 : 1);
  await db
    .update(schema.negotiations)
    .set({ status: "open", round, maxRounds: round + 4, buyerLimit: room.agreedPrice, sellerLimit: room.agreedPrice })
    .where(eq(schema.negotiations.id, roomId));

  const other = askerIsBuyer ? room.sellerId : room.buyerId;
  await db.insert(schema.notifications).values({ userId: other, title: "They asked for another time", body: words, link: `/rooms/${roomId}` });
  console.log(`[room] ${roomId.slice(0, 8)} new time asked: "${words}"`);
}
