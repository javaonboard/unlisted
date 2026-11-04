import type { getRoomView } from "./queries";
import { money, payoutOf } from "@/lib/payments/fees";
import { inSentence } from "@/lib/text/words";

type RoomView = NonNullable<Awaited<ReturnType<typeof getRoomView>>>;
export type Next = { state: "needs_you" | "waiting" | "upcoming" | "talking" | "done"; label: string; act?: boolean }; // act: there's a button for you, even if it isn't due yet

// Who the viewer is in this deal, in plain words.
export function roleOf(data: RoomView, viewerId: string) {
  const { room, item, names, need } = data;
  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const service = item.kind === "skill";
  const rental = need?.type === "rent";
  const price = room.agreedPrice ? money(Number(room.agreedPrice)) : null;
  const payout = room.agreedPrice ? `${money(payoutOf(Number(room.agreedPrice)))} after fees` : null; // what the seller really receives
  const what = inSentence(item.title);

  if (rental && room.sellerId === viewerId) return { kind: "lender" as const, badge: "You're renting it out", title: `Renting your ${what} to ${first(room.buyerId)}${payout ? ` · you get ${payout}` : ""}` };
  if (rental && room.buyerId === viewerId) return { kind: "renter" as const, badge: "You're renting", title: `Renting ${first(room.sellerId)}'s ${what}${price ? ` · you pay ${price}` : ""}` };
  if (room.sellerId === viewerId) {
    return service
      ? { kind: "provider" as const, badge: "You do the job", title: `Your job for ${first(room.buyerId)}${payout ? ` · you get ${payout}` : ""}` }
      : { kind: "seller" as const, badge: "You're selling", title: `Selling your ${what} to ${first(room.buyerId)}${payout ? ` · you get ${payout}` : ""}` };
  }
  if (room.buyerId === viewerId) {
    return service
      ? { kind: "hiring" as const, badge: "You hired", title: `${first(room.sellerId)} does your ${what}${price ? ` · you pay ${price}` : ""}` }
      : { kind: "buyer" as const, badge: "You're buying", title: `Buying ${first(room.sellerId)}'s ${what}${price ? ` · you pay ${price}` : ""}` };
  }
  return { kind: "plan" as const, badge: "Your plan", title: room.label ?? item.title };
}

// What happens next in this deal, and whether it's on the viewer.
export function nextFor(data: RoomView, viewerId: string): Next {
  const { room, leg, names } = data;
  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const isBuyer = room.buyerId === viewerId;
  const other = first(isBuyer ? room.sellerId : room.buyerId);

  if (room.status === "waiting_owner") {
    const asked = data.pendingAsk?.by === viewerId;
    return asked ? { state: "needs_you", label: "Answer your agent" } : { state: "talking", label: `${other} is checking with their agent` };
  }
  if (room.status === "open") return { state: "talking", label: "Agents are talking" };
  if (room.status === "closed") return { state: "done", label: `Closed: ${room.closedReason}` };

  // Agreed. Steps in order: accept, pay (PayPal holds it), hand off, paid out.
  if (leg?.problem?.status === "open") {
    return leg.payeeId === viewerId ? { state: "needs_you", label: "Answer a refund request" } : { state: "waiting", label: `Waiting for ${other} to answer your problem` };
  }
  if (leg?.status === "capture_failed") return room.buyerId === viewerId ? { state: "needs_you", label: "PayPal declined: pay again" } : { state: "waiting", label: "PayPal declined their payment" };
  if (leg?.status === "payout_failed") return leg.payeeId === viewerId ? { state: "needs_you", label: "Payout failed: check your PayPal email" } : { state: "done", label: "Done, you have it" };
  if (leg?.status === "payout_sent") return leg.payeeId === viewerId ? { state: "upcoming", label: "Payout on its way" } : { state: "done", label: "Done and paid" };
  if (leg?.status === "paid_out" || leg?.status === "captured") return { state: "done", label: leg.problem?.status === "refunded" ? "Done, refunded" : "Done and paid" };
  // A rental that's out: the owner confirms when it comes back.
  if (leg?.status === "in_use") {
    return leg.payeeId === viewerId ? { state: "needs_you", label: "Confirm when it's back" } : { state: "upcoming", label: `Return it by ${data.booking?.endsAt.toLocaleString("en-US", { weekday: "short" }) ?? "the end date"}` };
  }
  if (leg?.status === "voided") return { state: "done", label: "Cancelled, nothing charged" };

  // In a plan, a sale can wait for the purchase. Then: both accept, the buyer pays, the handoff.
  if (data.blockedBy) return { state: "waiting", label: `Waiting for ${data.blockedBy}` };
  if (data.waitingOn.includes(viewerId)) return { state: "needs_you", label: "Approve the deal" };
  const notMe = data.waitingOn.filter((id) => id !== viewerId);
  if (notMe.length) return { state: "waiting", label: `Waiting for ${notMe.map(first).join(" and ")} to approve` };
  if (!leg || leg.status === "pending") {
    return room.buyerId === viewerId ? { state: "needs_you", label: "Pay with PayPal" } : { state: "waiting", label: `Waiting for ${other} to pay` };
  }

  const when = data.booking ? data.booking.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "soon";
  const service = leg.kind === "service";
  const rental = data.need?.type === "rent";
  const step = rental ? "Pickup" : service ? "Job" : "Handoff";
  // Due within the hour (or past): it's on the buyer now. Before that, the button is there but it's not urgent.
  const due = !data.booking || data.booking.startsAt.getTime() - Date.now() < 3_600_000;
  if (isBuyer) {
    const confirm = rental ? "confirm the pickup" : service ? "confirm when it's done" : "confirm when you have it";
    return { state: due ? "needs_you" : "upcoming", label: `${step} ${when} · ${confirm}`, act: true };
  }
  return { state: "upcoming", label: `${step} ${when} · ${other} confirms it`, act: true };
}

export type Role = ReturnType<typeof roleOf>;
