import type { Move } from "./moves";

export type Limits = {
  role: "buyer" | "seller";
  limit: number; // buyer: most they will pay. seller: least they will take.
};

// Checks a move against the owner's limits and the room rules.
// Returns an error to send back to the agent, or null if the move is fine.
export function checkMove(move: Move, limits: Limits, evidenceIds: string[], standingPrice: number | null) {
  const needsPrice = move.action === "offer" || move.action === "counter";
  if (needsPrice && move.price === null) return "Offers and counters need a price.";

  const price = move.action === "accept" ? standingPrice : move.price;
  if (move.action === "accept" && price === null) return "There is no offer to accept yet.";

  if (price !== null && (needsPrice || move.action === "accept")) {
    if (limits.role === "buyer" && price > limits.limit) {
      return `That is above your owner's limit of $${limits.limit}.`;
    }
    if (limits.role === "seller" && price < limits.limit) {
      return `That is below your owner's minimum of $${limits.limit}.`;
    }
  }

  const unknown = move.evidenceIds.filter((id) => !evidenceIds.includes(id));
  if (unknown.length) return `Unknown evidence ids: ${unknown.join(", ")}. Only cite listed evidence.`;
  return null;
}
