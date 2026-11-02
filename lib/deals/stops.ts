import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { publicSpot } from "@/lib/places";
import { inSentence } from "@/lib/text/words";
import { meetAtOf } from "./meet";

type Room = typeof schema.negotiations.$inferSelect;

// A helper's job (mover, courier…) built from the plan's agreed handoffs: what to carry, from where to where.
// Handoffs the other person handles (they collect, or they deliver) need no stop.
export async function stopsFor(ownerId: string, agreed: Room[]) {
  if (!agreed.length) return [];
  const [people, items, moves] = await Promise.all([
    db.select({ id: schema.users.id, name: schema.users.name, area: schema.users.area }).from(schema.users),
    db.select().from(schema.items).where(inArray(schema.items.id, agreed.map((r) => r.itemId!))),
    db.select().from(schema.offers).where(inArray(schema.offers.negotiationId, agreed.map((r) => r.id))),
  ]);
  const person = (id: string) => people.find((p) => p.id === id);
  const first = (id: string) => person(id)?.name.split(" ")[0] ?? "them";
  const owner = first(ownerId);

  return agreed.flatMap((room) => {
    const item = items.find((i) => i.id === room.itemId);
    const what = item ? inSentence(item.title) : "item";
    const where = meetAtOf(room, moves.filter((m) => m.negotiationId === room.id), false);
    const spot = publicSpot(person(room.buyerId)?.area ?? "", person(room.sellerId)?.area ?? "").name;

    if (room.buyerId === ownerId) {
      const seller = room.sellerId;
      if (where === "seller_home") return [`Pick up the ${what} at ${first(seller)}'s (${person(seller)?.area}) and bring it to ${owner}'s`];
      if (where === "public") return [`Pick up the ${what} at ${spot} and bring it to ${owner}'s`];
      return []; // the seller delivers
    }
    const buyer = room.buyerId;
    if (where === "buyer_home") return [`Take the ${what} from ${owner}'s to ${first(buyer)}'s (${person(buyer)?.area})`];
    if (where === "public") return [`Take the ${what} from ${owner}'s to ${spot}`];
    return []; // the buyer collects
  });
}
