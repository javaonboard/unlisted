import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type Room = typeof schema.negotiations.$inferSelect;
type Db = Pick<typeof db, "select">;

const GAP = 45_000; // how long a yes waits for parallel talks about the same thing to finish
const STEP = 3_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isGoods = async (room: Room, tx: Db = db) =>
  (await tx.select({ kind: schema.vaultItems.kind }).from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!)))[0]?.kind === "goods";

// Other talks about the same goods (a goods item can only be sold once) or the same need.
async function rivalsOf(room: Room, goods: boolean, tx: Db = db) {
  const same = goods ? or(eq(schema.negotiations.itemId, room.itemId!), eq(schema.negotiations.intentId, room.intentId!)) : eq(schema.negotiations.intentId, room.intentId!);
  const rooms = await tx.select().from(schema.negotiations).where(and(ne(schema.negotiations.id, room.id), inArray(schema.negotiations.status, ["open", "waiting_owner"]), same));
  if (!rooms.length) return [];
  const moves = await tx.select().from(schema.offers).where(inArray(schema.offers.negotiationId, rooms.map((r) => r.id)));
  return rooms.map((r) => {
    const last = moves.filter((m) => m.negotiationId === r.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    // Said yes but not claimed yet: still open, last move an accept.
    const ready = r.status === "open" && last?.kind === "accept" && last.round === r.round;
    return { room: r, ready, price: ready && last.price ? Number(last.price) : null };
  });
}

// The agents said yes. If other talks about the same thing are still going, wait a little
// so the owner's agent can compare, then the best price wins.
export async function settleAgreement(roomId: string, round: number, price: string | undefined) {
  await db.update(schema.negotiations).set({ round }).where(eq(schema.negotiations.id, roomId));
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  const goods = await isGoods(room);
  for (const until = Date.now() + GAP; Date.now() < until; await sleep(STEP)) {
    if (!(await rivalsOf(room, goods)).some((r) => !r.ready)) break;
  }
  return claimAgreement(roomId, round, price);
}

// Marks a room agreed, unless another room already took the same goods or need, or a better yes is waiting.
// Parallel rooms can say yes at the same moment, so the check and the update happen inside one
// transaction holding a lock per item and per need; the second room waits, sees the first, and closes.
export async function claimAgreement(roomId: string, round: number, price: string | undefined) {
  return db.transaction(async (tx) => {
    const [room] = await tx.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
    const goods = await isGoods(room, tx); // a service isn't used up: a provider can take many jobs

    if (goods) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`item:${room.itemId}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`need:${room.intentId}`}))`);

    const taken = await tx
      .select({ itemId: schema.negotiations.itemId })
      .from(schema.negotiations)
      .where(
        and(
          eq(schema.negotiations.status, "agreed"),
          ne(schema.negotiations.id, roomId),
          goods ? or(eq(schema.negotiations.itemId, room.itemId!), eq(schema.negotiations.intentId, room.intentId!)) : eq(schema.negotiations.intentId, room.intentId!),
        ),
      );

    // Another yes on the same thing at a better price: the seller gets the highest, the buyer pays the lowest.
    const mine = Number(price ?? 0);
    const better = (await rivalsOf(room, goods, tx)).find(
      (r) => r.price !== null && ((goods && r.room.itemId === room.itemId && r.price > mine) || (r.room.intentId === room.intentId && r.price < mine)),
    );

    const closedReason = taken.length
      ? taken.some((t) => t.itemId === room.itemId) ? "sold to someone else" : "went with another option"
      : better ? (better.room.itemId === room.itemId ? "another buyer offered more" : "another seller was cheaper") : null;
    if (closedReason) {
      await tx.update(schema.negotiations).set({ round, status: "closed", closedReason }).where(eq(schema.negotiations.id, roomId));
      console.log(`[room] ${roomId.slice(0, 8)} lost: ${closedReason}`);
      return false;
    }
    await tx.update(schema.negotiations).set({ round, status: "agreed", agreedPrice: price }).where(eq(schema.negotiations.id, roomId));
    return true;
  });
}
