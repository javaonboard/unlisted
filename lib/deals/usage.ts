import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AFTER_HANDOFF } from "@/lib/payments/states";
import type { Use } from "./clash";

type Db = Pick<typeof db, "select">;
type Room = typeof schema.negotiations.$inferSelect;

const DAY = 86_400_000;

// Loads how each room uses its item: the need says sale or rental, the agreed pickup and days give the dates,
// and the payment says whether a rental came back.
export async function usesOf(rooms: Room[], tx: Db = db): Promise<Map<string, Use>> {
  if (!rooms.length) return new Map();
  const ids = rooms.map((r) => r.id);
  const [needs, moves, legs] = await Promise.all([
    tx.select({ id: schema.intents.id, type: schema.intents.type, days: schema.intents.days }).from(schema.intents).where(inArray(schema.intents.id, rooms.map((r) => r.intentId!))),
    tx.select({ roomId: schema.offers.negotiationId, terms: schema.offers.terms, createdAt: schema.offers.createdAt }).from(schema.offers).where(inArray(schema.offers.negotiationId, ids)),
    tx.select({ roomId: schema.dealLegs.roomId, status: schema.dealLegs.status }).from(schema.dealLegs).where(inArray(schema.dealLegs.roomId, ids)),
  ]);
  return new Map(
    rooms.map((r) => {
      const need = needs.find((n) => n.id === r.intentId);
      const slot = moves
        .filter((m) => m.roomId === r.id && (m.terms as { slotStart?: string } | null)?.slotStart)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const from = slot ? new Date((slot.terms as { slotStart: string }).slotStart) : null;
      const valid = from && !Number.isNaN(from.getTime()) ? from : null;
      const leg = legs.find((l) => l.roomId === r.id);
      const sale = need?.type !== "rent";
      return [r.id, { sale, from: valid, to: valid ? new Date(valid.getTime() + (need?.days ?? 1) * DAY) : null, back: !sale && AFTER_HANDOFF.includes(leg?.status ?? "") }];
    }),
  );
}

// Rentals of this item that haven't come back yet, for the agents to plan around.
export async function rentedOut(itemId: string, exceptRoomId?: string) {
  const agreed = (await db.select().from(schema.negotiations).where(eq(schema.negotiations.itemId, itemId))).filter((r) => r.status === "agreed" && r.id !== exceptRoomId);
  const uses = await usesOf(agreed);
  return [...uses.values()].filter((u) => !u.sale && !u.back);
}
