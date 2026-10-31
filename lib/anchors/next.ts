import type { getRoomView } from "./queries";
import { money, payoutOf } from "@/lib/payments/fees";

type RoomView = NonNullable<Awaited<ReturnType<typeof getRoomView>>>;
export type Next = { state: "needs_you" | "waiting" | "upcoming" | "talking" | "done"; label: string };

// Who the viewer is in this deal, in plain words.
export function roleOf(data: RoomView, viewerId: string) {
  const { room, item, names } = data;
  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const service = item.kind === "skill";
  const price = room.agreedPrice ? money(Number(room.agreedPrice)) : null;
  const payout = room.agreedPrice ? `${money(payoutOf(Number(room.agreedPrice)))} after fees` : null; // what the seller really receives
  const what = item.title.toLowerCase();

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
  const { room, deal, leg, names } = data;
  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const isBuyer = room.buyerId === viewerId;
  const other = first(isBuyer ? room.sellerId : room.buyerId);

  if (room.status === "waiting_owner") {
    const asked = data.messages.some((m) => m.kind === "ask_owner" && m.fromUserId === viewerId);
    return asked ? { state: "needs_you", label: "Answer your agent" } : { state: "talking", label: `${other} is checking with their agent` };
  }
  if (room.status === "open") return { state: "talking", label: "Agents are talking" };
  if (room.status === "closed") return { state: "done", label: `Closed: ${room.closedReason}` };

  // Agreed. Steps in order: accept the deal and time (or approve the plan), hold the payment, hand off.
  if (leg?.status === "paid_out" || leg?.status === "captured") return { state: "done", label: "Done and paid" };
  if (leg?.status === "voided") return { state: "done", label: "Cancelled, nothing charged" };

  const isPlan = !!deal && deal.title !== room.label;
  const accepted = !data.waitingOn.includes(viewerId);
  if (isPlan && deal.ownerId === viewerId) {
    if (!data.hasLegs) return data.planSettled ? { state: "needs_you", label: "Approve the plan" } : { state: "waiting", label: "Waiting for the rest of the plan" };
    if (!accepted) return { state: "needs_you", label: "Accept the time and place" };
  } else if (!accepted) {
    return { state: "needs_you", label: isPlan || data.hasLegs ? "Accept the time and place" : "Accept the deal" };
  } else if (!data.hasLegs) {
    return { state: "waiting", label: isPlan ? `Waiting for ${first(deal.ownerId)} to approve` : `Waiting for ${other} to accept` };
  }

  if (leg?.status === "pending") {
    return leg.payerId === viewerId ? { state: "needs_you", label: "Hold the payment" } : { state: "waiting", label: `Waiting for ${first(leg.payerId)} to pay` };
  }
  const notMe = data.waitingOn.filter((id) => id !== viewerId);
  if (notMe.length) return { state: "waiting", label: `Waiting for ${notMe.map(first).join(" and ")} to accept the time and place` };

  const when = data.booking ? data.booking.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "soon";
  return { state: "upcoming", label: `Handoff ${when}` };
}

export type Role = ReturnType<typeof roleOf>;
