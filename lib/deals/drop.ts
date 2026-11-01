import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { runWave } from "@/lib/suggestions/engine";
import { onLegFinished } from "./coordinator";

type Room = typeof schema.negotiations.$inferSelect;
const live = (r: Room) => r.status === "open" || r.status === "waiting_owner";

// The owner lets the rest of the plan go ahead without one part that isn't agreed.
// That part leaves the plan and carries on as its own deal; the plan stops waiting for it.
export async function dropPart(roomId: string, ownerId: string): Promise<{ error: string | null; carryOn?: () => Promise<void> }> {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room?.dealId) return { error: "This isn't part of a plan." };
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, room.dealId));
  if (deal.ownerId !== ownerId) return { error: "Only the plan's owner can do this." };

  const selling = room.sellerId === ownerId;
  const all = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, deal.id));
  const part = all.filter((r) => (selling ? r.itemId === room.itemId && r.sellerId === ownerId : r.intentId === room.intentId));
  if (part.some((r) => r.status === "agreed")) return { error: "This part is already agreed." };

  for (const r of part) await db.update(schema.negotiations).set({ dealId: null }).where(eq(schema.negotiations.id, r.id));
  if (deal.helperIds.includes(room.intentId!)) {
    await db.update(schema.deals).set({ helperIds: deal.helperIds.filter((id) => id !== room.intentId) }).where(eq(schema.deals.id, deal.id));
  }
  console.log("[plan] part dropped", deal.id, room.label);
  await notify(ownerId, `${deal.title}: going ahead without ${room.label}`, "The rest of the plan carries on. I'll keep looking for that part on its own.", room.id);

  // The rest may be ready now (helpers booked around the goods); the dropped need keeps looking.
  const carryOn = async () => {
    await onLegFinished(deal.id);
    if (selling || part.some(live)) return;
    const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId!));
    if (need?.status === "open") await runWave(need.id, need.wave + 1);
  };
  return { error: null, carryOn };
}
