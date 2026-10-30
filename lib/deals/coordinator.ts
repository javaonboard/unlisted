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
  const services = legs.filter((l) => l.kind === "skill");
  const service = services.find((l) => l.room.status === "agreed") ?? services[0];

  // Ready when every item in the plan has a deal and nobody is still talking about it.
  const items = [...new Set(goods.map((l) => l.room.itemId))];
  const ready = items.every((id) => {
    const rooms = goods.filter((l) => l.room.itemId === id).map((l) => l.room);
    return rooms.some((r) => r.status === "agreed") && !rooms.some((r) => r.status === "open" || r.status === "waiting_owner");
  });

  // Once the goods are settled, book the mover around their times.
  if (!service && goods.length && ready && !starting.has(dealId)) {
    starting.add(dealId);
    try {
      const [need] = await db
        .select()
        .from(schema.intents)
        .where(and(eq(schema.intents.ownerId, deal.ownerId), eq(schema.intents.type, "request_service")));
      const providers = need ? (await findSupplyFor(need.id)).filter((i) => i.openToOffers).slice(0, 3) : [];
      if (!providers.length) return;

      // Talk to a few providers at once; the first fit wins and the rest close.
      const users = await db.select().from(schema.users);
      const rooms = await Promise.all(
        providers.map((provider) =>
          openRoom({
            dealId,
            label: `Mover · ${users.find((u) => u.id === provider.ownerId)?.name.split(" ")[0]}`,
            dependsOn: goods.filter((l) => l.room.status === "agreed").map((l) => l.room.id), // the mover serves these handoffs
            buyerId: deal.ownerId,
            sellerId: provider.ownerId,
            itemId: provider.id,
            intentId: need.id,
          }),
        ),
      );
      await Promise.all(rooms.map((room) => playRoom(room.id)));
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
