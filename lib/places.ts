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
