import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";
import { askForNewTime } from "@/lib/negotiation/owner";
import { meetAtOf } from "@/lib/deals/meet";
import { stopsFor } from "@/lib/deals/stops";
import { AFTER_HANDOFF } from "@/lib/payments/states";

const Adjust = z.object({
  adjust: z.array(z.object({ roomId: z.string(), note: z.string().describe("One instruction for the owner's agent in that deal: what to change and why") })),
  tellOwner: z.string().describe("One or two short sentences for the owner: what changed in the plan and what you're adjusting"),
});

const running = new Set<string>(); // plans being adjusted right now

// One part of a plan changed time or place. The plan agent looks at every part and decides what else has to
// move so the plan still works for everyone (a mover serving that pickup, a handoff that must come first).
// Code keeps it safe: only open, unpaid-or-pinned, not-yet-handed-off parts are touched, and a change the plan
// agent made doesn't trigger another round. Returns the rooms to play.
export async function onPlanChanged(roomId: string) {
  const [changed] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!changed?.dealId || changed.reopenedBy === "plan") return [];
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, changed.dealId));
  if (!deal?.isPlan || running.has(deal.id)) return [];
  running.add(deal.id);
  try {
    const rooms = (await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, deal.id))).filter((r) => r.status !== "closed");
    const ids = rooms.map((r) => r.id);
    const [legs, bookings, moves, users] = await Promise.all([
      db.select().from(schema.dealLegs).where(inArray(schema.dealLegs.roomId, ids)),
      db.select().from(schema.bookings).where(inArray(schema.bookings.roomId, ids)),
      db.select().from(schema.offers).where(inArray(schema.offers.negotiationId, ids)),
      db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users),
    ]);
    const first = (id: string) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? id;
    const leg = (id: string) => legs.find((l) => l.roomId === id);
    const done = (id: string) => ["in_use", ...AFTER_HANDOFF].includes(leg(id)?.status ?? "");

    // Helpers' stops follow the goods: rebuild them first so the agent sees the new job.
    const goods = rooms.filter((r) => r.status === "agreed" && !deal.helperIds.includes(r.intentId!));
    const stops = await stopsFor(deal.ownerId, goods);
    for (const r of rooms.filter((r) => deal.helperIds.includes(r.intentId!) && !done(r.id))) {
      await db.update(schema.negotiations).set({ stops }).where(eq(schema.negotiations.id, r.id));
      r.stops = stops;
    }

    const when = (id: string) => {
      const b = bookings.find((x) => x.roomId === id);
      return b ? `${b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })} to ${b.endsAt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}` : "no time yet";
    };
    const describe = (r: (typeof rooms)[number]) =>
      `- ${r.id} | ${r.label} | ${first(r.buyerId)} buys from ${first(r.sellerId)} | ${r.status}${done(r.id) ? ", already handed off" : leg(r.id) && leg(r.id)!.status !== "pending" ? ", paid" : ""} | ${when(r.id)} | meet: ${meetAtOf(r, moves.filter((m) => m.negotiationId === r.id), deal.helperIds.includes(r.intentId!))}${r.stops.length ? ` | stops: ${r.stops.join("; ")}` : ""}`;

    const { adjust, tellOwner } = await askForData({
      schema: Adjust,
      model: MODELS.small,
      content: `You coordinate ${first(deal.ownerId)}'s plan "${deal.title}" on Unlisted, a local marketplace.
One part just changed: ${changed.label}, now ${when(changed.id)}.
All parts of the plan:
${rooms.map(describe).join("\n")}

Which other parts must change so the plan still works for everyone? For example a mover whose stops include a pickup that moved,
or a handoff that has to happen before or after another one. Leave parts that still fit, and never change parts already handed off.
Return the roomId and a short instruction for each part to adjust (empty if none), and a short note for ${first(deal.ownerId)}.`,
    });

    const allowed = new Set(rooms.filter((r) => r.id !== changed.id && r.status === "agreed" && !done(r.id)).map((r) => r.id));
    const toAdjust = adjust.filter((a) => allowed.has(a.roomId));
    for (const a of toAdjust) await askForNewTime(a.roomId, deal.ownerId, a.note, "plan");
    await db.insert(schema.notifications).values({ userId: deal.ownerId, title: `${deal.title}: plan updated`, body: tellOwner, link: `/deals/${deal.id}` });
    console.log(`[plan] ${deal.title}: ${changed.label} changed, adjusting ${toAdjust.length} part(s)`);
    return toAdjust.map((a) => ({ id: a.roomId }));
  } finally {
    running.delete(deal.id);
  }
}
