import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { createAuthorizeOrder, authorizeOrder } from "@/lib/paypal/orders";
import { captureAuthorization, voidAuthorization } from "@/lib/paypal/payments";
import { sendPayout } from "@/lib/paypal/payouts";
import { confirmTime, waitingOn } from "@/lib/bookings";
import { notify } from "@/lib/notifications/notify";
import { FEE, payoutOf, rentalCapture } from "./fees";

const money = (n: number) => n.toFixed(2);

async function say(dealId: string, userId: string | null, message: string, data: Record<string, unknown> = {}) {
  await logActivity({ userId, type: "payment", message, data: { dealId, ...data } });
}

// The owner approves the plan: every agreed negotiation becomes a leg to pay.
export async function approveDeal(dealId: string, ownerId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (deal?.ownerId !== ownerId) throw new Error("Only the plan owner can approve it.");

  const existing = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.dealId, dealId));
  if (existing.length) return;

  const rooms = await db.select().from(schema.negotiations).where(and(eq(schema.negotiations.dealId, dealId), eq(schema.negotiations.status, "agreed")));
  const items = await db.select().from(schema.vaultItems).where(inArray(schema.vaultItems.id, rooms.map((r) => r.itemId!)));
  const needs = await db.select().from(schema.intents).where(inArray(schema.intents.id, rooms.map((r) => r.intentId!)));
  const kindOf = (room: (typeof rooms)[number]) =>
    needs.find((n) => n.id === room.intentId)?.type === "rent" ? ("rental" as const) : items.find((i) => i.id === room.itemId)?.kind === "skill" ? ("service" as const) : ("goods" as const);

  await db.insert(schema.dealLegs).values(
    rooms.map((room) => ({
      dealId,
      roomId: room.id,
      kind: kindOf(room),
      deposit: kindOf(room) === "rental" ? items.find((i) => i.id === room.itemId)?.deposit : null, // held with the fee, given back at return
      description: room.label ?? "Deal",
      payerId: room.buyerId,
      payeeId: room.sellerId,
      amount: room.agreedPrice!,
      handoffCode: String(randomInt(100000, 1000000)),
    })),
  );
  await db.update(schema.deals).set({ status: "approved" }).where(eq(schema.deals.id, dealId));
  for (const room of rooms) await confirmTime(room.id, ownerId); // approving the plan accepts its times too
  await say(dealId, null, "Plan approved. Each payer can now place a PayPal hold. Nobody is charged until the handoff.");
}

// A one-off negotiation (not part of a plan) becomes its own small deal.
export async function confirmSoloDeal(roomId: string, viewerId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room || room.status !== "agreed" || room.dealId) return room?.dealId ?? null;
  if (room.buyerId !== viewerId && room.sellerId !== viewerId) throw new Error("Not your deal.");
  const [deal] = await db.insert(schema.deals).values({ ownerId: viewerId, title: room.label ?? "Deal" }).returning();
  await db.update(schema.negotiations).set({ dealId: deal.id }).where(eq(schema.negotiations.id, roomId));
  await approveDeal(deal.id, viewerId);
  return deal.id;
}

// One PayPal order per payer, covering all their legs in this deal.
export async function createPayerOrder(dealId: string, payerId: string) {
  const legs = await db
    .select()
    .from(schema.dealLegs)
    .where(and(eq(schema.dealLegs.dealId, dealId), eq(schema.dealLegs.payerId, payerId), eq(schema.dealLegs.status, "pending")));
  if (!legs.length) throw new Error("Nothing to pay.");

  const total = legs.reduce((sum, l) => sum + Number(l.amount) + Number(l.deposit ?? 0), 0); // a rental's deposit is held too
  const order = await createAuthorizeOrder({ amount: money(total), description: legs.map((l) => l.description).join(" + ") });
  await db.update(schema.dealLegs).set({ orderId: order.orderId }).where(inArray(schema.dealLegs.id, legs.map((l) => l.id)));
  return { orderId: order.orderId };
}

// After the payer approves in PayPal: place the hold.
export async function holdPayment(orderId: string, payerId: string) {
  const legs = await db.select().from(schema.dealLegs).where(and(eq(schema.dealLegs.orderId, orderId), eq(schema.dealLegs.payerId, payerId)));
  if (!legs.length) throw new Error("Unknown order.");

  const { authorizationId } = await authorizeOrder(orderId);
  await db.update(schema.dealLegs).set({ authorizationId, status: "held", heldAt: new Date() }).where(eq(schema.dealLegs.orderId, orderId));
  for (const leg of legs) if (leg.roomId) await confirmTime(leg.roomId, payerId); // paying is saying yes to the time
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
  if (leg.roomId && (await waitingOn([leg.roomId]))[leg.roomId].length) throw new Error("Both sides need to confirm the time first.");

  // A rental starts at pickup. The money moves when it comes back (confirmReturn).
  if (leg.kind === "rental") {
    await db.update(schema.dealLegs).set({ status: "in_use", handoffAt: new Date() }).where(eq(schema.dealLegs.id, legId));
    await notify(payerId, "Picked up", `Enjoy it. The deposit is released when ${leg.description.toLowerCase()} goes back.`, leg.roomId);
    await notify(leg.payeeId, "It's out on rent", "Confirm here when it comes back. PayPal then takes the fee and releases the deposit.", leg.roomId);
    return;
  }

  // The hold may cover more legs; only the last capture closes it.
  const sameHold = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.authorizationId, leg.authorizationId!));
  const final = sameHold.every((l) => l.id === leg.id || l.status !== "held");

  const { captureId } = await captureAuthorization(leg.authorizationId!, leg.amount, final, `capture-${leg.id}`);
  await db.update(schema.dealLegs).set({ captureId, status: "captured", handoffAt: new Date() }).where(eq(schema.dealLegs.id, legId));
  await say(leg.dealId, payerId, `Handoff confirmed for ${leg.description}. PayPal captured $${Number(leg.amount).toFixed(0)}.`, { legId, captureId });
  await notify(payerId, "Handoff done", `PayPal charged $${Number(leg.amount).toFixed(0)}.`, leg.roomId);

  const [payee] = await db.select().from(schema.users).where(eq(schema.users.id, leg.payeeId));
  const payout = payoutOf(Number(leg.amount));
  if (!payee.paypalEmail) return;
  const { batchId } = await sendPayout(payee.paypalEmail, money(payout), `Unlisted: ${leg.description}`, leg.id);
  await db.update(schema.dealLegs).set({ payoutBatchId: batchId, status: "paid_out" }).where(eq(schema.dealLegs.id, legId));
  await say(leg.dealId, leg.payeeId, `Paid out $${payout.toFixed(2)} to ${payee.name.split(" ")[0]} (after Unlisted's ${FEE * 100}% fee).`, { legId, batchId });
  await notify(leg.payeeId, "You got paid", `$${payout.toFixed(2)} sent to your PayPal (after Unlisted's ${FEE * 100}% fee).`, leg.roomId);
}

// The rental came back. All good: PayPal captures just the fee and releases the deposit.
// Something wrong: the owner keeps the deposit too. Either way the owner is paid out.
export async function confirmReturn(legId: string, payeeId: string, goodShape: boolean) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payeeId !== payeeId || leg.kind !== "rental" || leg.status !== "in_use") throw new Error("This return can't be confirmed.");
  const take = rentalCapture(Number(leg.amount), Number(leg.deposit ?? 0), goodShape);

  const sameHold = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.authorizationId, leg.authorizationId!));
  const final = sameHold.every((l) => l.id === leg.id || !["held", "in_use"].includes(l.status));
  const { captureId } = await captureAuthorization(leg.authorizationId!, money(take), final, `capture-${leg.id}`);
  await db.update(schema.dealLegs).set({ captureId, status: "captured" }).where(eq(schema.dealLegs.id, legId));
  await notify(leg.payerId, goodShape ? "Returned, deposit released" : "Returned with a problem", goodShape ? `PayPal charged the $${take.toFixed(0)} fee and released your deposit.` : `The owner kept the deposit. PayPal charged $${take.toFixed(0)}.`, leg.roomId);

  const [payee] = await db.select().from(schema.users).where(eq(schema.users.id, leg.payeeId));
  const payout = payoutOf(take);
  if (!payee.paypalEmail) return;
  const { batchId } = await sendPayout(payee.paypalEmail, money(payout), `Unlisted: ${leg.description}`, leg.id);
  await db.update(schema.dealLegs).set({ payoutBatchId: batchId, status: "paid_out" }).where(eq(schema.dealLegs.id, legId));
  await notify(leg.payeeId, "You got paid", `$${payout.toFixed(2)} sent to your PayPal (after Unlisted's ${FEE * 100}% fee).`, leg.roomId);
}

// Before any handoff, a payer can cancel: the whole hold is released.
export async function cancelHold(dealId: string, payerId: string) {
  const legs = await db
    .select()
    .from(schema.dealLegs)
    .where(and(eq(schema.dealLegs.dealId, dealId), eq(schema.dealLegs.payerId, payerId)));
  const held = legs.filter((l) => l.status === "held");
  if (!held.length || legs.some((l) => l.status === "captured" || l.status === "paid_out")) {
    throw new Error("Only an untouched hold can be released.");
  }
  await voidAuthorization(held[0].authorizationId!);
  await db.update(schema.dealLegs).set({ status: "voided" }).where(inArray(schema.dealLegs.id, held.map((l) => l.id)));
  await say(dealId, payerId, "Hold released. Nothing was charged.");
  for (const leg of held) {
    await notify(payerId, "Hold released", "Nothing was charged.", leg.roomId);
    await notify(leg.payeeId, "They cancelled", "The buyer released the hold before the handoff. Nothing was charged.", leg.roomId);
  }
}
