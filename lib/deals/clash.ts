// How a deal uses a goods item: a sale for good, or a rental for some days.
export type Use = { sale: boolean; from: Date | null; to: Date | null; back: boolean };

// Whether a new deal on an item clashes with one already agreed.
// A sale takes it for good. A rental only blocks its own days, until it comes back.
// A sale can follow rentals: it hands off only after every one of them is back.
export function clashes(mine: Use, other: Use) {
  if (other.sale) return true;
  if (other.back) return false;
  if (!mine.from || !other.from || !other.to) return true; // days not known yet: play safe
  if (mine.sale) return mine.from < other.to;
  if (!mine.to) return true;
  return mine.from < other.to && other.from < mine.to;
}
