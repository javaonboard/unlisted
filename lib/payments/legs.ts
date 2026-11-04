import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { createAuthorizeOrder, authorizeOrder } from "@/lib/paypal/orders";
import { captureAuthorization } from "@/lib/paypal/payments";
import { sendPayout } from "@/lib/paypal/payouts";
import { approve, waitingFor } from "@/lib/deals/approval";
import { notify } from "@/lib/notifications/notify";
import { addItem } from "@/lib/items/mutations";
import { inSentence } from "@/lib/text/words";
import { FEE, payoutOf, rentalCapture } from "./fees";

const money = (n: number) => n.toFixed(2);

// The words for a payment message: what it's for and who's who. "the grey 3-seat sectional", "Ben", "Maya".
export async function aboutLeg(leg: { roomId: string | null; payerId: string; payeeId: string; description: string }) {
  const [room] = leg.roomId ? await db.select({ itemId: schema.negotiations.itemId }).from(schema.negotiations).where(eq(schema.negotiations.id, leg.roomId)) : [];
  const [item] = room?.itemId ? await db.select({ title: schema.items.title }).from(schema.items).where(eq(schema.items.id, room.itemId)) : [];
  const people = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const first = (id: string) => people.find((p) => p.id === id)?.name.split(" ")[0] ?? "them";
  return { what: `the ${inSentence(item?.title ?? leg.description)}`, payer: first(leg.payerId), payee: first(leg.payeeId) };
}

// A money step, on the deal's "What happened" list.
async function say(leg: { dealId: string; roomId: string | null; id: string }, userId: string | null, message: string, data: Record<string, unknown> = {}) {
  await logActivity({ userId, type: "payment", message, data: { dealId: leg.dealId, roomId: leg.roomId, legId: leg.id, ...data } });
}

// Once a deal is accepted it gets its payment step: who pays whom and how much.
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
  const [item] = await db.select().from(schema.items).where(eq(schema.items.id, room.itemId!));
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

  const { authorizationId, payerId: paypalId, payerEmail } = await authorizeOrder(orderId);
  await db
    .update(schema.dealLegs)
    .set({ authorizationId, status: "held", heldAt: new Date(), payerPaypalId: paypalId ?? null, payerPaypalEmail: payerEmail ?? null })
    .where(eq(schema.dealLegs.orderId, orderId));
  for (const leg of legs) if (leg.roomId) await approve(leg.roomId, payerId); // paying is saying yes
  const total = legs.reduce((sum, l) => sum + Number(l.amount) + Number(l.deposit ?? 0), 0);
  for (const leg of legs) {
    const w = await aboutLeg(leg);
    await say(leg, payerId, `${w.payer} paid $${(Number(leg.amount) + Number(leg.deposit ?? 0)).toFixed(0)} with PayPal. PayPal is holding it, nothing charged yet`, { orderId, authorizationId, total });
    await notify(payerId, `You paid $${Number(leg.amount).toFixed(0)} for ${w.what}`, `PayPal holds it until you confirm ${leg.kind === "service" ? "the job is done" : leg.kind === "rental" ? "the pickup" : "you have it"}. Nothing is charged before that.`, leg.roomId);
    await notify(leg.payeeId, `${w.payer} paid $${Number(leg.amount).toFixed(0)} for ${w.what}`, leg.kind === "rental" ? "PayPal holds the fee and deposit. You get paid when it's back and you confirm the return." : `PayPal holds it. You get paid once ${w.payer} confirms ${leg.kind === "service" ? "the job is done" : "the handoff"}.`, leg.roomId);
  }
}

// The buyer confirms they have it (after a clear "are you sure" in the app). Only they can.
export async function confirmHandoff(legId: string, payerId: string) {
  const [leg] = await db.select().from(schema.dealLegs).where(eq(schema.dealLegs.id, legId));
  if (!leg || leg.payerId !== payerId || leg.status !== "held") throw new Error("This handoff can't be confirmed.");
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
    const w = await aboutLeg(leg);
    await say(leg, payerId, `${w.payer} picked it up. PayPal keeps holding the fee and deposit until it's back`);
    await notify(payerId, `You picked up ${w.what}`, `Bring it back on time and your deposit is released.`, leg.roomId);
    await notify(leg.payeeId, `${w.payer} picked up ${w.what}`, `Confirm here when it comes back. PayPal then takes the fee and releases the deposit.`, leg.roomId);
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
  if (leg.kind === "goods") await markSold(leg); // it now belongs to the buyer
  else await needDone(leg);
  await say(leg, payerId, `${(await aboutLeg(leg)).payer} confirmed the ${leg.kind === "service" ? "job" : "handoff"}. PayPal charged $${Number(leg.amount).toFixed(0)}`, { captureId });
  const w = await aboutLeg(leg);
  await notify(payerId, leg.kind === "service" ? `${w.payee} did ${w.what}` : `You got ${w.what}`, `PayPal charged the $${Number(leg.amount).toFixed(0)} it was holding.`, leg.roomId);

  await payOut(leg, Number(leg.amount));
}

// Pays the person who earned it: the deal's seller, owner or provider, to their own PayPal email.
// No email yet: the money waits with Unlisted and they're asked to add one (then payWaiting sends it).
async function payOut(leg: typeof schema.dealLegs.$inferSelect, charged: number) {
  const [payee] = await db.select().from(schema.users).where(eq(schema.users.id, leg.payeeId));
  const payout = payoutOf(charged);
  const w = await aboutLeg(leg);
  if (!payee.paypalEmail) {
    await notify(leg.payeeId, "Add your PayPal email to get paid", `$${payout.toFixed(2)} for ${w.what} is waiting for you. Add your PayPal email on “What my agent knows” and I'll send it.`, leg.roomId);
    console.log("[payout] waiting for a PayPal email", leg.id);
    return;
  }
  const { batchId } = await sendPayout(payee.paypalEmail, money(payout), `Unlisted: ${leg.description}`, leg.id);
  await db.update(schema.dealLegs).set({ payoutBatchId: batchId, paidTo: payee.paypalEmail, status: "payout_sent" }).where(eq(schema.dealLegs.id, leg.id)); // "paid out" once PayPal confirms
  await say(leg, leg.payeeId, `Payout of $${payout.toFixed(2)} sent to ${payee.name.split(" ")[0]}'s PayPal (after Unlisted's ${FEE * 100}% fee)`, { batchId });
  await notify(leg.payeeId, `Payout sent for ${w.what}`, `$${payout.toFixed(2)} is on its way to your PayPal, ${payee.paypalEmail} (after Unlisted's ${FEE * 100}% fee).`, leg.roomId);
}

// Someone just added their PayPal email: send what was waiting for them. Safe to repeat (one payout id per deal).
export async function payWaiting(userId: string) {
  const waiting = await db.select().from(schema.dealLegs).where(and(eq(schema.dealLegs.payeeId, userId), eq(schema.dealLegs.status, "captured"), isNull(schema.dealLegs.payoutBatchId)));
  for (const leg of waiting) await payOut(leg, Number(leg.charged ?? leg.amount));
  return waiting.length;
}

// Goods handed over and paid: the item leaves the seller's things (to "Things I had") and the
// buyer's need is done. Sales the seller planned for it are done too.
async function markSold(leg: typeof schema.dealLegs.$inferSelect) {
  const [room] = leg.roomId ? await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, leg.roomId)) : [];
  if (!room) return;
  await db.update(schema.items).set({ soldAt: new Date(), openToOffers: false }).where(eq(schema.items.id, room.itemId!));
  await db.update(schema.intents).set({ status: "done" }).where(eq(schema.intents.id, room.intentId!));
  const [item] = await db.select({ category: schema.items.category }).from(schema.items).where(eq(schema.items.id, room.itemId!));
  await db.update(schema.intents).set({ status: "done" }).where(and(eq(schema.intents.ownerId, room.sellerId), eq(schema.intents.type, "sell"), eq(schema.intents.category, item.category)));
  await giveToBuyer(room);
}

// The deal that filled a need is done: it leaves "What I need".
async function needDone(leg: typeof schema.dealLegs.$inferSelect) {
  const [room] = leg.roomId ? await db.select({ intentId: schema.negotiations.intentId }).from(schema.negotiations).where(eq(schema.negotiations.id, leg.roomId)) : [];
  if (room?.intentId) await db.update(schema.intents).set({ status: "done" }).where(eq(schema.intents.id, room.intentId));
}

// The buyer now owns it: it shows in their things, private, worth what they paid. Their agent takes a look
// (price check, then ideas like renting it out between uses) through the usual "added" event.
async function giveToBuyer(room: typeof schema.negotiations.$inferSelect) {
  const [sold] = await db.select().from(schema.items).where(eq(schema.items.id, room.itemId!));
  const [already] = await db.select({ id: schema.items.id }).from(schema.items).where(and(eq(schema.items.ownerId, room.buyerId), eq(schema.items.title, sold.title), isNull(schema.items.soldAt)));
  if (already) return; // a repeated confirm doesn't add it twice
  const mine = await addItem(room.buyerId, { kind: "goods", title: sold.title, category: sold.category, condition: sold.condition ?? undefined, estimatedValue: Number(room.agreedPrice ?? sold.estimatedValue ?? 0), details: sold.details });
  await db.update(schema.items).set({ photos: sold.photos, inspection: sold.inspection }).where(eq(schema.items.id, mine.id));
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
  await say(leg, payeeId, goodShape ? `${(await aboutLeg(leg)).payee} confirmed the return. PayPal charged the $${take.toFixed(0)} fee and released the deposit` : `${(await aboutLeg(leg)).payee} kept the deposit. PayPal charged $${take.toFixed(0)}`, { captureId });
  await notify(leg.payerId, goodShape ? "Returned, deposit released" : "Returned with a problem", goodShape ? `PayPal charged the $${take.toFixed(0)} fee and released your deposit.` : `The owner kept the deposit. PayPal charged $${take.toFixed(0)}.`, leg.roomId);

  await needDone(leg);
  await payOut(leg, take);
}

