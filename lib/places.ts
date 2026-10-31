// Rough centers of the Austin neighborhoods in the demo, for distance only.
const PLACES: Record<string, [number, number]> = {
  "East Austin": [30.262, -97.719],
  Mueller: [30.298, -97.705],
  "Hyde Park": [30.305, -97.728],
  Cherrywood: [30.288, -97.715],
  "Windsor Park": [30.311, -97.692],
  Holly: [30.252, -97.724],
};

// Straight-line miles between two neighborhoods. Unknown places count as far.
export function milesBetween(a: string, b: string) {
  const p = PLACES[a];
  const q = PLACES[b];
  if (!p || !q) return 15;
  const dLat = (p[0] - q[0]) * 69;
  const dLng = (p[1] - q[1]) * 60;
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
}

// A link that opens the address in Google Maps.
export const mapsLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// Rough distance in words. Neighborhood to neighborhood on purpose, so nobody's exact spot shows.
export function distanceText(a: string, b: string) {
  if (a === b) return "same neighborhood";
  const miles = milesBetween(a, b);
  return miles < 1 ? "under a mile" : `about ${Math.round(miles)} mi`;
}

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

export type MeetAt = "seller_home" | "buyer_home" | "public";

// How far people go when they haven't said: sellers and providers 5 mi, people with a need 10 mi.
export const rangeOfOffer = (miles: number | null) => miles ?? 5;
export const rangeOfNeed = (miles: number | null) => miles ?? 10;

// Places to meet that keep each person within how far they'll go.
// At the seller's place the buyer drives; at the buyer's place the seller drives; a public spot is a drive for both.
export function placesInReach(p: { buyerArea: string; sellerArea: string; buyerMiles: number; sellerMiles: number }): MeetAt[] {
  const apart = milesBetween(p.buyerArea, p.sellerArea);
  const spot = publicSpot(p.buyerArea, p.sellerArea);
  const places: MeetAt[] = [];
  if (apart <= p.buyerMiles) places.push("seller_home");
  if (apart <= p.sellerMiles) places.push("buyer_home");
  if (milesBetween(p.buyerArea, spot.area) <= p.buyerMiles && milesBetween(p.sellerArea, spot.area) <= p.sellerMiles) places.push("public");
  return places;
}

// "within 5 mi", or "pickup only" for a seller who won't travel.
export const rangeText = (miles: number, isOffer: boolean) => (isOffer && miles === 0 ? "pickup only" : `within ${miles} mi`);
