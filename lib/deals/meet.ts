import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { reapprove } from "./approval";
import { distanceText, placesInReach, publicSpot, rangeOfNeed, rangeOfOffer, type MeetAt } from "@/lib/places";

export type { MeetAt };

// Who goes where for a deal: set by hand, else what the agents last agreed, else the usual
// (a service happens at the customer's, goods are picked up from the seller).
export function meetAtOf(room: { meetAt: MeetAt | null }, moves: { terms: unknown }[], isService: boolean): MeetAt {
  const agreed = [...moves].reverse().map((m) => (m.terms as { meetAt?: MeetAt }).meetAt).find(Boolean);
  return room.meetAt ?? agreed ?? (isService ? "buyer_home" : "seller_home");
}

// Where to meet. The street address is private, so it's only filled in when `reveal` is true
// (both accepted and the payment is held).
export async function meetingPoint(room: { buyerId: string; sellerId: string }, meetAt: MeetAt, viewerId: string, reveal: boolean) {
  const people = await db.select().from(schema.users).where(inArray(schema.users.id, [room.buyerId, room.sellerId]));
  const person = (id: string) => people.find((p) => p.id === id);
  const first = (id: string) => person(id)?.name.split(" ")[0] ?? "them";

  if (meetAt === "public") {
    const spot = publicSpot(person(room.buyerId)?.area ?? "", person(room.sellerId)?.area ?? "");
    const otherId = viewerId === room.buyerId ? room.sellerId : room.buyerId;
    const trip = `${distanceText(person(viewerId)?.area ?? "", spot.area)} for you, ${distanceText(person(otherId)?.area ?? "", spot.area)} for ${first(otherId)}`;
    return { meetAt, label: `Public spot: ${spot.name} (${trip})`, address: reveal ? spot.address : null };
  }
  const hostId = meetAt === "seller_home" ? room.sellerId : room.buyerId;
  const guestId = hostId === room.sellerId ? room.buyerId : room.sellerId;
  const trip = distanceText(person(hostId)?.area ?? "", person(guestId)?.area ?? "");
  const label = hostId === viewerId ? `Your place: ${first(guestId)} comes to you (${trip})` : `${first(hostId)}'s place (${trip} away)`;
  return { meetAt, label, address: reveal ? (person(hostId)?.address ?? null) : null };
}

const SAY: Record<MeetAt, string> = { seller_home: "at the seller's place", buyer_home: "at the buyer's place", public: "at a public spot" };

// Where this deal can happen without anyone driving past their range.
export async function placesFor(room: { buyerId: string; sellerId: string; itemId: string | null; intentId: string | null }) {
  const [[item], [need], people] = await Promise.all([
    db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!)),
    db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId!)),
    db.select({ id: schema.users.id, area: schema.users.area }).from(schema.users).where(inArray(schema.users.id, [room.buyerId, room.sellerId])),
  ]);
  const area = (id: string) => people.find((p) => p.id === id)?.area ?? "";
  return placesInReach({ buyerArea: area(room.buyerId), sellerArea: area(room.sellerId), buyerMiles: rangeOfNeed(need?.maxMiles ?? null), sellerMiles: rangeOfOffer(item?.maxMiles ?? null) });
}

// One person changes where to meet. Like a time change, the other side accepts again.
export async function changeMeetAt(roomId: string, userId: string, meetAt: MeetAt) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed" || (room.buyerId !== userId && room.sellerId !== userId)) return;
  if (!(await placesFor(room)).includes(meetAt)) return; // too far for someone's range
  const other = room.buyerId === userId ? room.sellerId : room.buyerId;

  if (room.meetAt === meetAt) return; // a second click changes nothing
  await db.update(schema.negotiations).set({ meetAt, reopenedBy: "owner" }).where(eq(schema.negotiations.id, roomId));
  await reapprove(roomId, userId);
  await notify(other, "They changed where to meet", `Now ${SAY[meetAt]}. Please accept or change it.`, roomId);
}
