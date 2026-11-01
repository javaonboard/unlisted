import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { refundCapture } from "@/lib/paypal/payments";
import { AFTER_HANDOFF } from "@/lib/payments/states";

// After the handoff it's not a back-out but a problem: the buyer says what's wrong and asks for a refund
// (part or all of what was charged). The seller agrees or declines. Agreed refunds go back through PayPal.
export async function reportProblem(legId: string, payerId: string, note: string, refund: number) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payerId !== payerId || !AFTER_HANDOFF.includes(leg.status) || leg.problem) return "This can't be reported now.";
  const charged = Number(leg.charged ?? leg.amount);
  const amount = Math.min(Math.max(1, Math.round(refund * 100) / 100), charged);
  await db.update(schema.dealLegs).set({ problem: { note, refund: amount, status: "open" } }).where(eq(schema.dealLegs.id, legId));
  await notify(leg.payeeId, "A problem was reported", `On “${leg.description}”: “${note}”. They ask for a $${amount.toFixed(2)} refund.`, leg.roomId);
  return null;
}

// The seller answers. Agreeing refunds through PayPal (once, even on a double click).
export async function answerProblem(legId: string, payeeId: string, agree: boolean) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payeeId !== payeeId || leg.problem?.status !== "open") return;
  const status = agree ? "refunded" : "declined";
  const [claimed] = await db
    .update(schema.dealLegs)
    .set({ problem: { ...leg.problem, status } })
    .where(and(eq(schema.dealLegs.id, legId), inArray(schema.dealLegs.status, ["captured", "payout_sent", "paid_out", "payout_failed"])))
    .returning();
  if (!claimed) return;
  if (agree) {
    const { refundId } = await refundCapture(leg.captureId!, leg.problem.refund.toFixed(2));
    await db.update(schema.dealLegs).set({ refundId: refundId ?? null }).where(eq(schema.dealLegs.id, legId));
    await notify(leg.payerId, "Refund sent", `$${leg.problem.refund.toFixed(2)} is on its way back to your PayPal.`, leg.roomId);
  } else {
    await notify(leg.payerId, "Refund declined", "They didn't agree. You can still open a case with PayPal from your PayPal account.", leg.roomId);
  }
}
