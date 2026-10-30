import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { rankBuyers, rankSellers } from "@/lib/scout/rank";
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

  // If every talk about one thing died, hop to the Scout's next candidate.
  if (await hopIfStuck(deal, goods.map((l) => l.room))) return;

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
      const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, deal.ownerId));
      const providers = need ? (await rankSellers(need.id, owner.area)).slice(0, 2) : [];
      if (!providers.length) return;

      // Talk to the Scout's top providers at once; the first fit wins and the rest close.
      const rooms = await Promise.all(
        providers.map((provider) =>
          openRoom({
            dealId,
            label: `Mover · ${provider.name.split(" ")[0]}`,
            dependsOn: goods.filter((l) => l.room.status === "agreed").map((l) => l.room.id), // the mover serves these handoffs
            buyerId: deal.ownerId,
            sellerId: provider.userId,
            itemId: provider.itemId!,
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

  // The mover's job is booked when their room agrees (see lib/bookings.ts).
  if (service?.room.status === "agreed") {
    await db.update(schema.deals).set({ status: "approved" }).where(eq(schema.deals.id, dealId));
  }
}

const MAX_TRIES = 5;

type Room = typeof schema.negotiations.$inferSelect;

// Opens one more room for a sale or purchase where nobody is talking and nothing was agreed.
async function hopIfStuck(deal: typeof schema.deals.$inferSelect, rooms: Room[]) {
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, deal.ownerId));
  const groups = [
    { rooms: rooms.filter((r) => r.sellerId === deal.ownerId), selling: true },
    { rooms: rooms.filter((r) => r.buyerId === deal.ownerId), selling: false },
  ];

  for (const { rooms: tried, selling } of groups) {
    if (!tried.length || tried.length >= MAX_TRIES) continue;
    if (tried.some((r) => r.status === "agreed" || r.status === "open" || r.status === "waiting_owner")) continue;

    const anchor = tried[0];
    const ranked = selling ? await rankBuyers(anchor.itemId!, owner.area) : await rankSellers(anchor.intentId!, owner.area);
    const next = ranked.find((p) => !tried.some((r) => (selling ? r.buyerId : r.sellerId) === p.userId));
    if (!next) continue;

    const room = await openRoom({
      dealId: deal.id,
      label: selling ? `${anchor.label?.split(" → ")[0]} → ${next.name.split(" ")[0]}` : `${next.name.split(" ")[0]}'s sofa`,
      buyerId: selling ? next.userId : deal.ownerId,
      sellerId: selling ? deal.ownerId : next.userId,
      itemId: selling ? anchor.itemId! : next.itemId!,
      intentId: selling ? next.intentId! : anchor.intentId!,
    });
    console.log("[scout] hopping to", next.name);
    await playRoom(room.id);
    return true;
  }
  return false;
}
