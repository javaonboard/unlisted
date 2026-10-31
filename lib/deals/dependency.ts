type Room = { id: string; status: string; buyerId: string; sellerId: string; intentId: string | null; label: string | null; dependsOn: string[] };
type Deal = { ownerId: string; isPlan: boolean; saleWaitsForPurchase: boolean; helperIds: string[] };

// What a deal in a plan is still waiting for, in plain words, or null if it can go ahead.
// - The owner's sale waits until every purchase in the plan is agreed (if they chose that).
// - A helper's job (mover, installer) is opened only after the goods are agreed, so it never waits here.
export function blockedBy(room: Room, deal: Deal | null | undefined, planRooms: Room[]): string | null {
  if (!deal?.isPlan || !deal.saleWaitsForPurchase || room.sellerId !== deal.ownerId) return null;
  const purchases = new Map<string, Room[]>();
  for (const r of planRooms) {
    if (r.buyerId !== deal.ownerId || !r.intentId || deal.helperIds.includes(r.intentId)) continue;
    purchases.set(r.intentId, [...(purchases.get(r.intentId) ?? []), r]);
  }
  const open = [...purchases.values()].find((rooms) => !rooms.some((r) => r.status === "agreed"));
  return open ? "the purchase to be agreed first" : null;
}
