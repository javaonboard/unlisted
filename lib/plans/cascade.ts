import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { askForNewTime } from "@/lib/negotiation/owner";
import { meetAtOf } from "@/lib/deals/meet";
import { stopsFor } from "@/lib/deals/stops";
import { AFTER_HANDOFF } from "@/lib/payments/states";

const Adjust = z.object({
  adjust: z.array(z.object({ roomId: z.string(), note: z.string().describe("One instruction for the owner's agent in that deal: what to change and why") })),
  tellOwner: z.string().describe("One or two short sentences for the owner: what changed in the plan and what you're adjusting"),
});

const running = new Set<string>(); // plans being adjusted right now

// One part of a plan changed time or place: the plan agent checks what else has to move.
// A change the plan agent made itself doesn't trigger another round. Returns the rooms to play.
export async function onPlanChanged(roomId: string) {
  const [changed] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!changed?.dealId || changed.reopenedBy === "plan") return [];
  return reviewPlan(changed.dealId, changed);
}

// The plan agent decides which parts must move so the plan works for everyone (a mover's stops, handoff order).
// Only agreed parts not yet handed off can move, each at most once. With no changed part it checks the whole plan.
export async function reviewPlan(dealId: string, changed?: typeof schema.negotiations.$inferSelect) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
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
      content: `You coordinate ${first(deal.ownerId)}'s plan "${deal.title}" on Unlisted, a local marketplace.
${changed ? `One part just changed: ${changed.label}, now ${when(changed.id)}.` : "Every sale and purchase in the plan is now agreed. Check the plan as a whole before helpers are booked."}
${deal.saleWaitsForPurchase ? `${first(deal.ownerId)} sells only once their purchase works out, so each sale's handoff should come after the purchase's handoff: they need the new one in place first.\n` : ""}All parts of the plan:
${rooms.map(describe).join("\n")}

Which parts must change so the plan works for everyone? For example a mover whose stops include a pickup that moved,
a handoff that has to happen before or after another one, or ${first(deal.ownerId)} left without something they still need for days.
Leave parts that still fit, and never change parts already handed off.
Return the roomId and a short instruction for each part to adjust (empty if none), and a short note for ${first(deal.ownerId)}.`,
    });

    const allowed = new Set(rooms.filter((r) => r.id !== changed?.id && r.status === "agreed" && !done(r.id) && r.reopenedBy !== "plan").map((r) => r.id));
    const toAdjust = adjust.filter((a) => allowed.has(a.roomId));
    for (const a of toAdjust) await askForNewTime(a.roomId, deal.ownerId, a.note, "plan");
    if (changed || toAdjust.length) {
      await db.insert(schema.notifications).values({ userId: deal.ownerId, title: `${deal.title}: plan updated`, body: tellOwner, link: `/deals/${deal.id}` });
    }
    console.log(`[plan] ${deal.title}: ${changed ? `${changed.label} changed` : "checked"}, adjusting ${toAdjust.length} part(s)`);
    return toAdjust.map((a) => ({ id: a.roomId }));
  } finally {
    running.delete(deal.id);
  }
}
