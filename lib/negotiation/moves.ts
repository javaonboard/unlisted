import { randomUUID } from "node:crypto";
import { z } from "zod";

// The only moves an agent can make in a room.
export const Move = z.object({
  action: z.enum(["offer", "counter", "question", "accept", "reject", "walk_away"]),
  price: z.number().nullable().describe("USD. Required for offer and counter."),
  pickup: z.string().nullable().describe("Proposed pickup or service time, e.g. 'Sat 10am'"),
  extras: z.array(z.string()).describe("Things added to the deal, e.g. 'includes cushions'"),
  evidenceIds: z.array(z.string()).describe("Evidence ids that back up any claim in the message"),
  message: z.string().describe("One or two short sentences the other side will read"),
  reasoning: z.string().describe("Private note for your owner: why this move"),
  signalsUsed: z.array(z.string()).describe("Which counterparty signals influenced this move"),
});
export type Move = z.infer<typeof Move>;

// Wraps a move in an A2A v1.0 message: a text part for people, a data part for code.
export function toA2AMessage(move: Move, from: string, contextId: string) {
  const { reasoning: _private, signalsUsed: _alsoPrivate, ...shared } = move;
  return {
    messageId: randomUUID(),
    contextId,
    role: "ROLE_AGENT",
    metadata: { from },
    parts: [
      { text: move.message },
      { data: { "unlisted.move": shared }, mediaType: "application/json" },
    ],
  };
}
