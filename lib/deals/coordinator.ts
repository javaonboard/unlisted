import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { findSupplyFor } from "@/lib/matching/matcher";
import { openRoom, playRoom } from "@/lib/negotiation/room";

const starting = new Set<string>(); // deals whose service leg is being opened right now

async function legsOf(dealId: string) {
  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, dealId));
  const items = await db.select().from(schema.vaultItems);
  return rooms.map((room) => ({ room, kind: items.find((i) => i.id === room.itemId)?.kind }));
}

// Called whenever a leg of a linked deal stops talking.
export async function onLegFinished(dealId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  const legs = await legsOf(dealId);
  const goods = legs.filter((l) => l.kind === "goods");
  const service = legs.find((l) => l.kind === "skill");

  // Once both goods legs agree, book the mover around their times.
  if (!service && goods.length && goods.every((l) => l.room.status === "agreed") && !starting.has(dealId)) {
    starting.add(dealId);
    try {
      const [need] = await db
        .select()
        .from(schema.intents)
        .where(and(eq(schema.intents.ownerId, deal.ownerId), eq(schema.intents.type, "request_service")));
      const [provider] = need ? (await findSupplyFor(need.id)).filter((i) => i.openToOffers) : [];
      if (!provider) return;
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, provider.ownerId));
      const room = await openRoom({
        dealId,
        label: `Mover · ${user.name.split(" ")[0]}`,
        buyerId: deal.ownerId,
        sellerId: provider.ownerId,
        itemId: provider.id,
        intentId: need.id,
      });
      await playRoom(room.id);
    } finally {
      starting.delete(dealId);
    }
    return;
  }

  // When the mover agrees, put the job on their schedule.
  if (service?.room.status === "agreed") {
    const [existing] = await db.select().from(schema.bookings).where(eq(schema.bookings.dealId, dealId));
    const [last] = (await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, service.room.id))).filter((m) => m.price).slice(-1);
    const start = new Date(((last?.terms ?? {}) as { slotStart?: string }).slotStart ?? "");
    if (!existing && !Number.isNaN(start.getTime())) {
      await db.insert(schema.bookings).values({
        providerId: service.room.sellerId,
        title: `${deal.title}: both stops`,
        startsAt: start,
        endsAt: new Date(start.getTime() + 2 * 3_600_000),
        dealId,
      });
      console.log("[deal] mover booked", start.toISOString());
    }
    await db.update(schema.deals).set({ status: "approved" }).where(eq(schema.deals.id, dealId));
  }
}
