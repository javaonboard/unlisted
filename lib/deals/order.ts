type Room = { id: string; status: string; sellerId: string; intentId: string | null };
type Deal = { ownerId: string; helperIds: string[] };

// The order a plan's parts should be approved in: the owner's purchase first (a sale can wait for it),
// then the sale, then helpers, whose jobs are planned around those handoffs.
export function planRank(room: Room, deal: Deal) {
  if (room.intentId && deal.helperIds.includes(room.intentId)) return 2;
  return room.sellerId === deal.ownerId ? 1 : 0;
}

// "Step 2 of 3" for each live part of a plan. Ended talks don't count.
export function planSteps(rooms: Room[], deal: Deal) {
  const live = rooms.filter((r) => r.status !== "closed").sort((a, b) => planRank(a, deal) - planRank(b, deal));
  return new Map(live.map((r, i) => [r.id, { step: i + 1, total: live.length }]));
}

// Threads with a plan's parts kept together in plan order; groups and other threads newest first.
export function inPlanOrder<T extends { roomId: string; at: Date; planId: string | null }>(threads: T[], steps: Map<string, { step: number }>) {
  const key = (t: T) => t.planId ?? t.roomId;
  const latest = new Map<string, number>();
  for (const t of threads) latest.set(key(t), Math.max(latest.get(key(t)) ?? 0, t.at.getTime()));
  return [...threads].sort(
    (a, b) => latest.get(key(b))! - latest.get(key(a))! || key(a).localeCompare(key(b)) || (steps.get(a.roomId)?.step ?? 0) - (steps.get(b.roomId)?.step ?? 0) || b.at.getTime() - a.at.getTime(),
  );
}
