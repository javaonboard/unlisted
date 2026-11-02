// How a deal uses a goods item: a sale for good, or a rental for some days.
export type Use = { sale: boolean; from: Date | null; to: Date | null; back: boolean };

// Whether a new deal clashes with one already agreed. A sale takes the item for good;
// a rental only blocks its days until it's back, and a sale hands off after every rental is back.
export function clashes(mine: Use, other: Use) {
  if (other.sale) return true;
  if (other.back) return false;
  if (!mine.from || !other.from || !other.to) return true; // days not known yet: play safe
  if (mine.sale) return mine.from < other.to;
  if (!mine.to) return true;
  return mine.from < other.to && other.from < mine.to;
}
