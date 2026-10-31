import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { confirmTime } from "@/lib/bookings";
import { milesBetween } from "@/lib/places";

export type MeetAt = "seller_home" | "buyer_home" | "public";

// Busy, well-lit public places for handing over goods. Demo data.
const PUBLIC_SPOTS = [
  { name: "East Austin rec center, front lobby", address: "211 Comal Example St, Austin, TX", area: "East Austin" },
  { name: "Mueller town square, by the fountain", address: "1900 Aldrich Example St, Austin, TX", area: "Mueller" },
  { name: "Hyde Park library, front steps", address: "4500 Duval Example St, Austin, TX", area: "Hyde Park" },
  { name: "Windsor Park shopping center, front lot", address: "6700 Berkman Example Dr, Austin, TX", area: "Windsor Park" },
];

// The public spot that is easiest for both people.
export function publicSpot(areaA: string, areaB: string) {
  const trip = (spot: (typeof PUBLIC_SPOTS)[number]) => milesBetween(areaA, spot.area) + milesBetween(areaB, spot.area);
  return [...PUBLIC_SPOTS].sort((x, y) => trip(x) - trip(y))[0];
}

// Where to meet. The street address is private, so it's only filled in when `reveal` is true
// (both accepted and the payment is held).
export async function meetingPoint(room: { buyerId: string; sellerId: string }, meetAt: MeetAt, viewerId: string, reveal: boolean) {
  const people = await db.select().from(schema.users).where(inArray(schema.users.id, [room.buyerId, room.sellerId]));
  const person = (id: string) => people.find((p) => p.id === id);
  const first = (id: string) => person(id)?.name.split(" ")[0] ?? "them";

  if (meetAt === "public") {
    const spot = publicSpot(person(room.buyerId)?.area ?? "", person(room.sellerId)?.area ?? "");
    return { meetAt, label: `Public spot: ${spot.name}`, address: reveal ? spot.address : null };
  }
  const hostId = meetAt === "seller_home" ? room.sellerId : room.buyerId;
  const guestId = hostId === room.sellerId ? room.buyerId : room.sellerId;
  const label = hostId === viewerId ? `Your place: ${first(guestId)} comes to you` : `${first(hostId)}'s place`;
  return { meetAt, label, address: reveal ? (person(hostId)?.address ?? null) : null };
}

const SAY: Record<MeetAt, string> = { seller_home: "at the seller's place", buyer_home: "at the buyer's place", public: "at a public spot" };

// One person changes where to meet. Like a time change, the other side accepts again.
export async function changeMeetAt(roomId: string, userId: string, meetAt: MeetAt) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed" || (room.buyerId !== userId && room.sellerId !== userId)) return;
  const other = room.buyerId === userId ? room.sellerId : room.buyerId;

  await db.update(schema.negotiations).set({ meetAt }).where(eq(schema.negotiations.id, roomId));
  await db.update(schema.bookings).set({ confirmedAt: null }).where(eq(schema.bookings.roomId, roomId));
  await confirmTime(roomId, userId);
  await notify(other, "They changed where to meet", `Now ${SAY[meetAt]}. Please accept or change it.`, roomId);
}
