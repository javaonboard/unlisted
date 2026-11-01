import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getRoomView } from "@/lib/anchors/queries";
import { nextFor, roleOf } from "@/lib/anchors/next";

// A plan at a glance: its parts grouped as selling, buying and helpers, each with where it stands.
// The owner sees every part; anyone else only the parts they're in.
export async function getPlan(dealId: string, viewerId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal?.isPlan) return null;
  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, dealId));
  const visible = rooms.filter((r) => deal.ownerId === viewerId || r.buyerId === viewerId || r.sellerId === viewerId);
  if (!visible.length) return null;

  const parts = await Promise.all(
    visible.map(async (room) => {
      const view = (await getRoomView(room.id, viewerId))!;
      const group = deal.helperIds.includes(room.intentId!) ? "helper" : room.sellerId === deal.ownerId ? "sell" : "buy";
      return { room, group, item: { kind: view.item.kind, photos: view.item.photos }, role: roleOf(view, viewerId), next: nextFor(view, viewerId), distance: view.distance };
    }),
  );
  return { deal, parts, isOwner: deal.ownerId === viewerId };
}
