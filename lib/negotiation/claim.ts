import { and, eq, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Marks a room agreed, unless another room already took the same goods or the same need.
// Parallel rooms can say yes at the same moment, so the check and the update happen inside one
// transaction holding a lock per item and per need; the second room waits, sees the first, and closes.
export async function claimAgreement(roomId: string, round: number, price: string | undefined) {
  return db.transaction(async (tx) => {
    const [room] = await tx.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
    const [item] = await tx.select({ kind: schema.vaultItems.kind }).from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!));
    const goods = item?.kind === "goods"; // a service isn't used up: a provider can take many jobs

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

    if (taken.length) {
      const closedReason = taken.some((t) => t.itemId === room.itemId) ? "sold to someone else" : "went with another option";
      await tx.update(schema.negotiations).set({ round, status: "closed", closedReason }).where(eq(schema.negotiations.id, roomId));
      console.log(`[room] ${roomId.slice(0, 8)} lost the race: ${closedReason}`);
      return false;
    }
    await tx.update(schema.negotiations).set({ round, status: "agreed", agreedPrice: price }).where(eq(schema.negotiations.id, roomId));
    return true;
  });
}
