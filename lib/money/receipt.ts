import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getOrder } from "@/lib/paypal/orders";
import { feeOf, payoutOf } from "@/lib/payments/fees";

// One payment, as a receipt: the money lines, what happened when, and PayPal's own references.
// Only the two people in the deal can see it. PayPal's live status is fetched on the server.
export async function getReceipt(legId: string, viewerId: string) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || (leg.payerId !== viewerId && leg.payeeId !== viewerId)) return null;
  const names = Object.fromEntries((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users)).map((u) => [u.id, u.name]));

  const price = Number(leg.amount);
  const deposit = Number(leg.deposit ?? 0);
  const charged = leg.charged ? Number(leg.charged) : price; // before the capture, show what it will be
  const paypalStatus = leg.orderId ? await getOrder(leg.orderId).then((o) => String(o.status ?? "")).catch(() => "unavailable") : null;

  return {
    leg,
    payer: names[leg.payerId],
    payee: names[leg.payeeId],
    lines: [
      { label: leg.kind === "rental" ? "Rental fee" : leg.kind === "service" ? "Job" : "Price", amount: price },
      ...(deposit ? [{ label: charged > price ? "Deposit (kept: something was wrong)" : "Deposit (held, given back at return)", amount: deposit }] : []),
      { label: `Unlisted fee, 8%, paid by ${names[leg.payeeId]?.split(" ")[0]}`, amount: -feeOf(charged) },
      { label: `${names[leg.payeeId]?.split(" ")[0]} receives`, amount: payoutOf(charged) },
    ],
    timeline: [
      { label: "Accepted", at: leg.createdAt },
      { label: "Paid, held by PayPal", at: leg.heldAt },
      { label: leg.kind === "rental" ? "Picked up" : "Handed off", at: leg.handoffAt },
      { label: "Charged by PayPal", at: leg.capturedAt },
      { label: "Paid out", at: leg.paidOutAt },
    ],
    paypal: [
      { label: "Order", id: leg.orderId },
      { label: "Authorization (hold)", id: leg.authorizationId },
      { label: "Capture", id: leg.captureId },
      { label: "Payout batch", id: leg.payoutBatchId },
    ],
    paypalStatus,
  };
}
