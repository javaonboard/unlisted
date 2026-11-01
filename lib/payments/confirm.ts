import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { getPayoutItemStatus } from "@/lib/paypal/payouts";

type Stage = "hold" | "capture" | "payout" | "refund" | "release";
type Leg = typeof schema.dealLegs.$inferSelect;

// Which signed PayPal event confirms (or fails) which money step.
export const PAYPAL_EVENTS: Record<string, { stage: Stage; ok: boolean }> = {
  "PAYMENT.AUTHORIZATION.CREATED": { stage: "hold", ok: true },
  "PAYMENT.AUTHORIZATION.VOIDED": { stage: "release", ok: true },
  "PAYMENT.CAPTURE.COMPLETED": { stage: "capture", ok: true },
  "PAYMENT.CAPTURE.DENIED": { stage: "capture", ok: false },
  "PAYMENT.CAPTURE.DECLINED": { stage: "capture", ok: false },
  "PAYMENT.CAPTURE.REFUNDED": { stage: "refund", ok: true },
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": { stage: "payout", ok: true },
  "PAYMENT.PAYOUTS-ITEM.FAILED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.RETURNED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.BLOCKED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.DENIED": { stage: "payout", ok: false },
};

// PayPal confirmed (or failed) one step of a payment. Safe to repeat: the same event changes nothing twice.
// Only this moves a payout to "paid out"; a failed charge or payout is marked and both people hear about it.
export async function applyPayPal(leg: Leg, stage: Stage, ok: boolean, eventId: string) {
  if (leg.confirmed[stage]?.eventId === eventId) return;
  await db.update(schema.dealLegs).set({ confirmed: { ...leg.confirmed, [stage]: { eventId, at: new Date().toISOString() } } }).where(eq(schema.dealLegs.id, leg.id));

  if (stage === "payout" && ok && leg.status === "payout_sent") {
    await db.update(schema.dealLegs).set({ status: "paid_out", paidOutAt: new Date() }).where(eq(schema.dealLegs.id, leg.id));
    await notify(leg.payeeId, "PayPal confirmed your payout", `The money for “${leg.description}” is in your PayPal account.`, leg.roomId);
  }
  if (stage === "payout" && !ok && ["payout_sent", "paid_out"].includes(leg.status)) {
    await db.update(schema.dealLegs).set({ status: "payout_failed" }).where(eq(schema.dealLegs.id, leg.id));
    await notify(leg.payeeId, "Your payout didn't go through", `PayPal couldn't deliver the money for “${leg.description}”. Check that your PayPal email is right; Unlisted still holds it for you.`, leg.roomId);
  }
  if (stage === "capture" && !ok) {
    await db.update(schema.dealLegs).set({ status: "capture_failed" }).where(eq(schema.dealLegs.id, leg.id));
    for (const userId of [leg.payerId, leg.payeeId]) {
      await notify(userId, "PayPal declined the payment", `For “${leg.description}”. Nothing was charged. The buyer can pay again from the deal.`, leg.roomId);
    }
  }
}

// Safety net if a payout webhook never arrives: after 30 minutes, ask PayPal directly.
export async function checkWaitingPayouts() {
  const waiting = await db
    .select()
    .from(schema.dealLegs)
    .where(and(eq(schema.dealLegs.status, "payout_sent"), lt(schema.dealLegs.capturedAt, new Date(Date.now() - 30 * 60_000))));
  for (const leg of waiting) {
    const status = await getPayoutItemStatus(leg.payoutBatchId!).catch(() => null);
    if (status === "SUCCESS") await applyPayPal(leg, "payout", true, `check-${leg.payoutBatchId}`);
    else if (status && ["FAILED", "RETURNED", "UNCLAIMED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"].includes(status)) await applyPayPal(leg, "payout", false, `check-${leg.payoutBatchId}`);
  }
}
