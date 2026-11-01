import { randomInt } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { createAuthorizeOrder, authorizeOrder } from "@/lib/paypal/orders";
import { captureAuthorization, voidAuthorization } from "@/lib/paypal/payments";
import { sendPayout } from "@/lib/paypal/payouts";
import { approve, waitingFor } from "@/lib/deals/approval";
import { notify } from "@/lib/notifications/notify";
import { FEE, payoutOf, rentalCapture } from "./fees";

const money = (n: number) => n.toFixed(2);

async function say(dealId: string, userId: string | null, message: string, data: Record<string, unknown> = {}) {
  await logActivity({ userId, type: "payment", message, data: { dealId, ...data } });
}

// Once a deal is accepted it gets its payment step: who pays whom, how much, and a handoff code.
// A one-off deal gets its own small deal record; a deal in a plan uses the plan's.
export async function openLeg(roomId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed") return null;
  const [existing] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.roomId, roomId));
  if (existing) return existing;

  let dealId = room.dealId;
  if (!dealId) {
    [{ id: dealId }] = await db.insert(schema.deals).values({ ownerId: room.buyerId, title: room.label ?? "Deal" }).returning({ id: schema.deals.id });
    await db.update(schema.negotiations).set({ dealId }).where(eq(schema.negotiations.id, roomId));
  }
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, room.itemId!));
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId!));
  const kind = need?.type === "rent" ? ("rental" as const) : item?.kind === "skill" ? ("service" as const) : ("goods" as const);
  const [leg] = await db
    .insert(schema.dealLegs)
    .values({
      dealId,
      roomId,
      kind,
      deposit: kind === "rental" ? item?.deposit : null, // held with the fee, given back at return
      description: room.label ?? "Deal",
      payerId: room.buyerId,
      payeeId: room.sellerId,
      amount: room.agreedPrice!,
      handoffCode: String(randomInt(100000, 1000000)),
    })
    .returning();
  return leg;
}

// One PayPal order per deal: its price, plus a rental's deposit.
export async function createPayerOrder(legId: string, payerId: string) {
  const [leg] = await db.select().from(schema.dealLegs).where(and(eq(schema.dealLegs.id, legId), eq(schema.dealLegs.payerId, payerId), eq(schema.dealLegs.status, "pending")));
  if (!leg) throw new Error("Nothing to pay.");
  const total = Number(leg.amount) + Number(leg.deposit ?? 0);
  const order = await createAuthorizeOrder({ amount: money(total), description: leg.description });
  await db.update(schema.dealLegs).set({ orderId: order.orderId }).where(eq(schema.dealLegs.id, legId));
  return { orderId: order.orderId };
}

// After the payer approves in PayPal: place the hold.
export async function holdPayment(orderId: string, payerId: string) {
  const legs = await db.select().from(schema.dealLegs).where(and(eq(schema.dealLegs.orderId, orderId), eq(schema.dealLegs.payerId, payerId)));
  if (!legs.length) throw new Error("Unknown order.");

  const { authorizationId } = await authorizeOrder(orderId);
  await db.update(schema.dealLegs).set({ authorizationId, status: "held", heldAt: new Date() }).where(eq(schema.dealLegs.orderId, orderId));
  for (const leg of legs) if (leg.roomId) await approve(leg.roomId, payerId); // paying is saying yes
  const total = legs.reduce((sum, l) => sum + Number(l.amount) + Number(l.deposit ?? 0), 0);
  await say(legs[0].dealId, payerId, `PayPal hold placed: $${total.toFixed(0)} for ${legs.map((l) => l.description).join(" + ")}. Not charged yet.`, { orderId, authorizationId });
  for (const leg of legs) {
    await notify(payerId, "Payment held", `$${Number(leg.amount).toFixed(0)} is held by PayPal, not charged. It goes through when you confirm the handoff.`, leg.roomId);
    await notify(leg.payeeId, "They paid into hold", `$${Number(leg.amount).toFixed(0)} is held by PayPal. Show your code at the handoff to get paid.`, leg.roomId);
  }
}

// The payer got the item or the job is done: take the money and pay the other side.
export async function confirmHandoff(legId: string, payerId: string, code: string) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payerId !== payerId || leg.status !== "held") throw new Error("This handoff can't be confirmed.");
  if (leg.handoffCode !== code.trim()) throw new Error("That code doesn't match.");
  const [room] = leg.roomId ? await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, leg.roomId)) : [];
  if (room && waitingFor(room).length) throw new Error("Both sides need to approve the deal first.");

  // Claimed in one step, so a double click can't run the handoff twice.
  const [claimed] = await db
    .update(schema.dealLegs)
    .set({ handoffAt: new Date(), ...(leg.kind === "rental" ? { status: "in_use" as const } : {}) })
    .where(and(eq(schema.dealLegs.id, legId), eq(schema.dealLegs.status, "held"), isNull(schema.dealLegs.handoffAt)))
    .returning();
  if (!claimed) return;

  // A rental starts at pickup. The money moves when it comes back (confirmReturn).
  if (leg.kind === "rental") {
    await notify(payerId, "Picked up", `Enjoy it. The deposit is released when ${leg.description.toLowerCase()} goes back.`, leg.roomId);
    await notify(leg.payeeId, "It's out on rent", "Confirm here when it comes back. PayPal then takes the fee and releases the deposit.", leg.roomId);
    return;
  }

  // The hold may cover more legs; only the last capture closes it.
  const sameHold = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.authorizationId, leg.authorizationId!));
  const final = sameHold.every((l) => l.id === leg.id || l.status !== "held");

  const { captureId } = await captureAuthorization(leg.authorizationId!, leg.amount, final, `capture-${leg.id}`).catch(async (error) => {
    await db.update(schema.dealLegs).set({ handoffAt: null }).where(eq(schema.dealLegs.id, legId)); // let them try again
    throw error;
  });
  await db.update(schema.dealLegs).set({ captureId, status: "captured", capturedAt: new Date(), charged: leg.amount }).where(eq(schema.dealLegs.id, legId));
  await say(leg.dealId, payerId, `Handoff confirmed for ${leg.description}. PayPal captured $${Number(leg.amount).toFixed(0)}.`, { legId, captureId });
  await notify(payerId, "Handoff done", `PayPal charged $${Number(leg.amount).toFixed(0)}.`, leg.roomId);

  const [payee] = await db.select().from(schema.users).where(eq(schema.users.id, leg.payeeId));
  const payout = payoutOf(Number(leg.amount));
  if (!payee.paypalEmail) return;
  const { batchId } = await sendPayout(payee.paypalEmail, money(payout), `Unlisted: ${leg.description}`, leg.id);
  await db.update(schema.dealLegs).set({ payoutBatchId: batchId, status: "paid_out", paidOutAt: new Date() }).where(eq(schema.dealLegs.id, legId));
  await say(leg.dealId, leg.payeeId, `Paid out $${payout.toFixed(2)} to ${payee.name.split(" ")[0]} (after Unlisted's ${FEE * 100}% fee).`, { legId, batchId });
  await notify(leg.payeeId, "You got paid", `$${payout.toFixed(2)} sent to your PayPal (after Unlisted's ${FEE * 100}% fee).`, leg.roomId);
}

// The rental came back. All good: PayPal captures just the fee and releases the deposit.
// Something wrong: the owner keeps the deposit too. Either way the owner is paid out.
export async function confirmReturn(legId: string, payeeId: string, goodShape: boolean) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payeeId !== payeeId || leg.kind !== "rental" || leg.status !== "in_use") throw new Error("This return can't be confirmed.");
  const take = rentalCapture(Number(leg.amount), Number(leg.deposit ?? 0), goodShape);
  const [claimed] = await db
    .update(schema.dealLegs)
    .set({ capturedAt: new Date() })
    .where(and(eq(schema.dealLegs.id, legId), eq(schema.dealLegs.status, "in_use"), isNull(schema.dealLegs.capturedAt)))
    .returning();
  if (!claimed) return; // already being confirmed

  const sameHold = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.authorizationId, leg.authorizationId!));
  const final = sameHold.every((l) => l.id === leg.id || !["held", "in_use"].includes(l.status));
  const { captureId } = await captureAuthorization(leg.authorizationId!, money(take), final, `capture-${leg.id}`).catch(async (error) => {
    await db.update(schema.dealLegs).set({ capturedAt: null }).where(eq(schema.dealLegs.id, legId));
    throw error;
  });
  await db.update(schema.dealLegs).set({ captureId, status: "captured", capturedAt: new Date(), charged: money(take) }).where(eq(schema.dealLegs.id, legId));
  await notify(leg.payerId, goodShape ? "Returned, deposit released" : "Returned with a problem", goodShape ? `PayPal charged the $${take.toFixed(0)} fee and released your deposit.` : `The owner kept the deposit. PayPal charged $${take.toFixed(0)}.`, leg.roomId);

  const [payee] = await db.select().from(schema.users).where(eq(schema.users.id, leg.payeeId));
  const payout = payoutOf(take);
  if (!payee.paypalEmail) return;
  const { batchId } = await sendPayout(payee.paypalEmail, money(payout), `Unlisted: ${leg.description}`, leg.id);
  await db.update(schema.dealLegs).set({ payoutBatchId: batchId, status: "paid_out", paidOutAt: new Date() }).where(eq(schema.dealLegs.id, legId));
  await notify(leg.payeeId, "You got paid", `$${payout.toFixed(2)} sent to your PayPal (after Unlisted's ${FEE * 100}% fee).`, leg.roomId);
}

// Before the handoff, the payer can cancel: the hold is released and nothing is charged.
export async function cancelHold(legId: string, payerId: string) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payerId !== payerId) throw new Error("Only an untouched hold can be released.");
  const [claimed] = await db.update(schema.dealLegs).set({ status: "voided" }).where(and(eq(schema.dealLegs.id, legId), eq(schema.dealLegs.status, "held"), isNull(schema.dealLegs.handoffAt))).returning();
  if (!claimed) return; // already released, or the handoff happened
  await voidAuthorization(leg.authorizationId!).catch(async (error) => {
    await db.update(schema.dealLegs).set({ status: "held" }).where(eq(schema.dealLegs.id, legId));
    throw error;
  });
  await say(leg.dealId, payerId, "Hold released. Nothing was charged.");
  await notify(payerId, "Hold released", "Nothing was charged.", leg.roomId);
  await notify(leg.payeeId, "They cancelled", "The buyer released the hold before the handoff. Nothing was charged.", leg.roomId);
}
