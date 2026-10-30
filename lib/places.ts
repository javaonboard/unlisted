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
