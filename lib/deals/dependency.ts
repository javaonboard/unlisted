type Room = { id: string; status: string; buyerId: string; sellerId: string; intentId: string | null; label: string | null; dependsOn: string[] };
type Deal = { ownerId: string; isPlan: boolean; saleWaitsForPurchase: boolean; helperIds: string[] };

// What a plan's deal still waits for, or null. The owner's sale can wait for their purchases to be agreed.
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
