import type { Move } from "./moves";

export type Limits = {
  role: "buyer" | "seller";
  limit: number; // hard limit: buyer pays at most, seller takes at least
  target: number; // where the owner would be happy
};

type Busy = { startsAt: Date; endsAt: Date };

// Checks a move against the owner's limits and the room rules.
// Returns an error to send back to the agent, or null if the move is fine.
export function checkMove(
  move: Move,
  rules: { limits: Limits; evidenceIds: string[]; standingPrice: number | null; alreadyAsked: boolean; busy: Busy[] },
) {
  const { limits } = rules;

  if (move.action === "ask_owner") {
    if (rules.alreadyAsked) return "You already asked your owner in this room. Decide yourself now.";
    if (!move.askOwner) return "ask_owner needs a question.";
    return null;
  }

  const needsPrice = move.action === "offer" || move.action === "counter";
  if (needsPrice && move.price === null) return "Offers and counters need a price.";

  const price = move.action === "accept" ? rules.standingPrice : move.price;
  if (move.action === "accept" && price === null) return "There is no offer to accept yet.";

  if (price !== null && (needsPrice || move.action === "accept")) {
    if (limits.role === "buyer" && price > limits.limit) {
      return `$${price} is above your owner's limit of $${limits.limit}. Counter lower, or use ask_owner if this deal is worth it.`;
    }
    if (limits.role === "seller" && price < limits.limit) {
      return `$${price} is below your owner's minimum of $${limits.limit}. Counter higher, or use ask_owner if this deal is worth it.`;
    }
  }

  if (move.slotStart) {
    const start = new Date(move.slotStart);
    const end = new Date(start.getTime() + 2 * 3_600_000);
    if (Number.isNaN(start.getTime())) return "slotStart must be an ISO time.";
    const clash = rules.busy.find((b) => start < b.endsAt && end > b.startsAt);
    if (clash) return `That slot clashes with an existing booking until ${clash.endsAt.toTimeString().slice(0, 5)}.`;
  }

  const unknown = move.evidenceIds.filter((id) => !rules.evidenceIds.includes(id));
  if (unknown.length) return `Unknown evidence ids: ${unknown.join(", ")}. Only cite listed evidence.`;
  return null;
}
