type Entry = { room: { status: string; agreedPrice: string | null }; other: string; lastPrice: string | null };

// One line of what matters most across every agent on this item or need.
export function Highlights({ entries, buying }: { entries: Entry[]; buying: boolean }) {
  if (!entries.length) return null;
  const deal = entries.find((e) => e.room.status === "agreed");
  const prices = entries.map((e) => Number(e.lastPrice)).filter(Boolean);
  const best = prices.length ? (buying ? Math.min(...prices) : Math.max(...prices)) : null;
  const talking = entries.filter((e) => e.room.status === "open").length;
  const closed = entries.filter((e) => e.room.status === "closed").length;

  const parts = [
    deal ? `✓ Deal with ${deal.other} at $${Number(deal.room.agreedPrice).toFixed(0)}` : best ? `Best offer so far $${best.toFixed(0)}` : null,
    talking ? `${talking} talking` : null,
    closed ? `${closed} closed` : null,
  ].filter(Boolean);
  return <p className="mb-3 rounded-xl bg-secondary px-3 py-2 text-sm">{parts.join(" · ")}</p>;
}
