import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { usesOf } from "@/lib/deals/usage";
import { clashes } from "@/lib/deals/clash";
import { publish } from "@/lib/events/bus";

type Room = typeof schema.negotiations.$inferSelect;
type Db = Pick<typeof db, "select">;

const GAP = 45_000; // how long a yes waits for parallel talks about the same thing to finish
const STEP = 3_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isGoods = async (room: Room, tx: Db = db) =>
  (await tx.select({ kind: schema.items.kind }).from(schema.items).where(eq(schema.items.id, room.itemId!)))[0]?.kind === "goods";

// Other talks about the same goods (a goods item can only be sold once) or the same need.
async function rivalsOf(room: Room, goods: boolean, tx: Db = db) {
  const same = goods ? or(eq(schema.negotiations.itemId, room.itemId!), eq(schema.negotiations.intentId, room.intentId!)) : eq(schema.negotiations.intentId, room.intentId!);
  const found = await tx.select().from(schema.negotiations).where(and(ne(schema.negotiations.id, room.id), inArray(schema.negotiations.status, ["open", "waiting_owner"]), same));
  // Two rentals of one thing can both happen on different days; only sales compete for the item itself.
  const uses = await usesOf([room, ...found], tx);
  const rooms = found.filter((r) => r.intentId === room.intentId || (uses.get(r.id)!.sale && uses.get(room.id)!.sale));
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

// Marks a room agreed unless another deal took the same thing or a better yes is waiting.
// Locks per item and need, so two rooms saying yes at once can't both win.
export async function claimAgreement(roomId: string, round: number, price: string | undefined) {
  return db.transaction(async (tx) => {
    const [room] = await tx.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
    const goods = await isGoods(room, tx); // a service isn't used up: a provider can take many jobs

    if (goods) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`item:${room.itemId}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`need:${room.intentId}`}))`);

    const agreed = await tx
      .select()
      .from(schema.negotiations)
      .where(
        and(
          eq(schema.negotiations.status, "agreed"),
          ne(schema.negotiations.id, roomId),
          goods ? or(eq(schema.negotiations.itemId, room.itemId!), eq(schema.negotiations.intentId, room.intentId!)) : eq(schema.negotiations.intentId, room.intentId!),
        ),
      );

    // The need is filled by any other deal; the item only if the two deals clash (see usage.ts).
    const uses = await usesOf([room, ...agreed], tx);
    const taken = agreed.filter((t) => t.intentId === room.intentId || clashes(uses.get(room.id)!, uses.get(t.id)!));

    // Another yes on the same thing at a better price: the seller gets the highest, the buyer pays the lowest.
    const mine = Number(price ?? 0);
    const better = (await rivalsOf(room, goods, tx)).find(
      (r) => r.price !== null && ((goods && r.room.itemId === room.itemId && r.price > mine) || (r.room.intentId === room.intentId && r.price < mine)),
    );

    const closedReason = taken.length
      ? (() => {
          const item = taken.find((t) => t.itemId === room.itemId && t.intentId !== room.intentId);
          return !item ? "went with another option" : uses.get(item.id)!.sale ? "sold to someone else" : uses.get(room.id)!.sale ? "it's rented out then" : "already rented out those days";
        })()
      : better ? (better.room.itemId === room.itemId ? "another buyer offered more" : "another seller was cheaper") : null;
    if (closedReason) {
      await tx.update(schema.negotiations).set({ round, status: "closed", closedReason }).where(eq(schema.negotiations.id, roomId));
      console.log(`[room] ${roomId.slice(0, 8)} lost: ${closedReason}`);
      return false;
    }
    await tx.update(schema.negotiations).set({ round, status: "agreed", agreedPrice: price }).where(eq(schema.negotiations.id, roomId));
    return true;
  }).then(async (won) => {
    if (won) await publish("deal.agreed", { roomId }); // everyone else's agents catch up (see onDealAgreed)
    return won;
  });
}
