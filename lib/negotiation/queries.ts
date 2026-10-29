import { asc, desc, eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function listRooms(userId: string) {
  const rooms = await db
    .select()
    .from(schema.negotiations)
    .where(or(eq(schema.negotiations.buyerId, userId), eq(schema.negotiations.sellerId, userId)))
    .orderBy(desc(schema.negotiations.createdAt));

  const items = await db.select().from(schema.vaultItems);
  const users = await db.select().from(schema.users);
  return rooms.map((room) => ({
    ...room,
    item: items.find((i) => i.id === room.itemId),
    buyer: users.find((u) => u.id === room.buyerId),
    seller: users.find((u) => u.id === room.sellerId),
  }));
}

export async function getRoom(roomId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room) return null;

  const [[item], [intent], users, moves] = await Promise.all([
    db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!)),
    db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId!)),
    db.select().from(schema.users),
    db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(asc(schema.offers.round)),
  ]);

  return {
    room,
    item,
    intent,
    moves,
    buyer: users.find((u) => u.id === room.buyerId)!,
    seller: users.find((u) => u.id === room.sellerId)!,
  };
}
