import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { playRoom } from "@/lib/negotiation/room";
import { voidAuthorization } from "@/lib/paypal/payments";

const HOUR = 3_600_000;
const RULES = {
  ownerReminder: 1 * HOUR,
  ownerDefault: 3 * HOUR, // then the agent keeps the owner's limit
  approveWithin: 24 * HOUR, // after everything is agreed
  payReminder: 2 * HOUR,
  payWithin: 12 * HOUR,
  holdDays: 3 * 24 * HOUR, // PayPal honors a hold for 3 days
};

// Sends a notification once: skipped if the same one already exists.
async function remind(userId: string, title: string, body: string, link: string) {
  const [sent] = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.title, title), eq(schema.notifications.link, link)));
  if (!sent) await db.insert(schema.notifications).values({ userId, title, body, link });
}

// Owners who don't answer their agent: remind, then go with the safe answer.
async function ownerQuestions(now: number) {
  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.status, "waiting_owner"));
  for (const room of rooms) {
    const asks = (await db.select().from(schema.offers).where(and(eq(schema.offers.negotiationId, room.id), eq(schema.offers.kind, "ask_owner")))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const ask = asks[0];
    if (!ask) continue;
    const waited = now - ask.createdAt.getTime();
    const link = `/rooms/${room.id}`;

    if (waited > RULES.ownerDefault) {
      await db.insert(schema.offers).values({ negotiationId: room.id, fromUserId: ask.fromUserId, round: room.round, kind: "owner_note", note: "No answer in 3 hours, so keep my original limit." });
      await db.update(schema.negotiations).set({ status: "open" }).where(eq(schema.negotiations.id, room.id));
      await remind(ask.fromUserId, "Your agent went ahead", "You didn't answer, so your agent kept your original limit.", link);
      console.log("[timeouts] owner default for", room.id.slice(0, 8));
      playRoom(room.id).catch((e) => console.error("[timeouts] room failed", e?.message));
    } else if (waited > RULES.ownerReminder) {
      await remind(ask.fromUserId, "Your agent is still waiting", ask.note ?? "Your agent has a question.", link);
    }
  }
}

// Plans that are agreed but never approved, and payers who never place the hold.
async function approvalsAndPayments(now: number) {
  const plans = await db.select().from(schema.deals).where(eq(schema.deals.status, "proposed"));
  for (const plan of plans) {
    const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, plan.id));
    const settled = rooms.length > 0 && !rooms.some((r) => r.status === "open" || r.status === "waiting_owner") && rooms.some((r) => r.status === "agreed");
    if (!settled) continue;
    const lastChange = Math.max(...(await db.select().from(schema.offers).where(inArray(schema.offers.negotiationId, rooms.map((r) => r.id)))).map((m) => m.createdAt.getTime()));
    const link = `/deals/${plan.id}`;

    if (now - lastChange > RULES.approveWithin) {
      await db.update(schema.deals).set({ status: "cancelled" }).where(eq(schema.deals.id, plan.id));
      for (const r of rooms.filter((r) => r.status === "agreed")) {
        const other = r.buyerId === plan.ownerId ? r.sellerId : r.buyerId;
        await remind(other, "A deal was called off", `${r.label}: the other side didn't confirm in time.`, `/rooms/${r.id}`);
      }
      await logActivity({ userId: plan.ownerId, type: "plan", message: "Plan closed: it wasn't approved in time.", data: { dealId: plan.id } });
    } else {
      await remind(plan.ownerId, "Your plan is ready", "Everything is agreed. Approve it to hold the payments.", link);
    }
  }

  const pending = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.status, "pending"));
  for (const leg of pending) {
    const waited = now - leg.createdAt.getTime();
    if (waited > RULES.payWithin) {
      await db.update(schema.dealLegs).set({ status: "voided" }).where(eq(schema.dealLegs.id, leg.id));
      await remind(leg.payeeId, "Payment never came", `${leg.description}: the buyer didn't place the hold, so it's cancelled.`, `/rooms/${leg.roomId}`);
      await logActivity({ userId: leg.payerId, type: "payment", message: `${leg.description} cancelled: no payment in 12 hours.`, data: { dealId: leg.dealId } });
    } else if (waited > RULES.payReminder) {
      await remind(leg.payerId, "Place your PayPal hold", `${leg.description} is waiting for your payment.`, `/rooms/${leg.roomId}`);
    }
  }
}

// Holds nobody confirmed: release them before PayPal's 3-day honor period ends.
async function staleHolds(now: number) {
  const held = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.status, "held"));
  const byHold = Map.groupBy(held.filter((l) => l.heldAt && now - l.heldAt.getTime() > RULES.holdDays), (l) => l.authorizationId!);
  for (const [authorizationId, legs] of byHold) {
    const sameHold = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.authorizationId, authorizationId));
    if (sameHold.some((l) => l.status === "captured" || l.status === "paid_out")) continue; // partly used holds just expire
    await voidAuthorization(authorizationId);
    await db.update(schema.dealLegs).set({ status: "voided" }).where(eq(schema.dealLegs.authorizationId, authorizationId));
    await logActivity({ userId: legs[0].payerId, type: "payment", message: "Hold released: the handoff wasn't confirmed in 3 days. Nothing was charged.", data: { dealId: legs[0].dealId } });
  }
}

export async function runTimeouts() {
  const now = Date.now();
  await ownerQuestions(now);
  await approvalsAndPayments(now);
  await staleHolds(now);
}
