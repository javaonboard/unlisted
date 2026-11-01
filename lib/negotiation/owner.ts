import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";
import { reapprove } from "@/lib/deals/approval";
import { AFTER_HANDOFF } from "@/lib/payments/states";

const Reply = z.object({
  newLimit: z.number().nullable().describe("A new price limit if the owner gave or allowed one, else null"),
});

// The owner answers their agent in their own words, e.g. "try $200 instead".
// We keep the words for the agent and pull out a new limit if there is one.
export async function applyOwnerReply(roomId: string, ownerId: string, words: string) {
  // Claimed in one step: a second click finds the room already answered.
  const [room] = await db.update(schema.negotiations).set({ status: "open" }).where(and(eq(schema.negotiations.id, roomId), eq(schema.negotiations.status, "waiting_owner"))).returning();
  if (!room) return;

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
      maxRounds: Math.max(room.maxRounds, room.round + 3), // room to act on the owner's answer
      ...(newLimit !== null && side === "buyer" ? { buyerLimit: newLimit.toFixed(2) } : {}),
      ...(newLimit !== null && side === "seller" ? { sellerLimit: newLimit.toFixed(2) } : {}),
    })
    .where(eq(schema.negotiations.id, roomId));
  console.log(`[room] ${roomId.slice(0, 8)} owner replied: "${words}" → limit ${newLimit ?? "unchanged"}`);
}

// After a deal, one side wants another time. The room reopens for the time only:
// the price is pinned, the asker counts as confirmed, and the asker's agent moves first.
export async function askForNewTime(roomId: string, ownerId: string, words: string) {
  const [current] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!current || (current.buyerId !== ownerId && current.sellerId !== ownerId)) return;
  const [done] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.roomId, roomId));
  if (done && (done.status === "in_use" || AFTER_HANDOFF.includes(done.status))) return; // already handed off
  // Claimed in one step: a second click finds the room already reopened.
  const [room] = await db.update(schema.negotiations).set({ status: "open" }).where(and(eq(schema.negotiations.id, roomId), eq(schema.negotiations.status, "agreed"))).returning();
  if (!room) return;

  await reapprove(roomId, ownerId);

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
  await notify(other, "They asked for another time", `“${words}” I'm working it out with their agent.`, roomId);
  console.log(`[room] ${roomId.slice(0, 8)} new time asked: "${words}"`);
}
