import { randomUUID } from "node:crypto";
import { z } from "zod";

// The only moves an agent can make in a room.
export const Move = z.object({
  action: z.enum(["offer", "counter", "question", "accept", "reject", "walk_away", "ask_owner"]),
  price: z.number().nullable().describe("USD. Required for offer and counter."),
  when: z.string().nullable().describe("Proposed time in plain words, e.g. 'Sat 10am'"),
  slotStart: z.string().nullable().describe("ISO start time of the handoff or job"),
  place: z.string().nullable().describe("Where the handoff or job happens, e.g. 'buyer picks up in East Austin'"),
  meetAt: z.enum(["seller_home", "buyer_home", "public"]).nullable().describe("Who goes where: seller_home (buyer picks up), buyer_home (delivery or the job), or public (a public exchange spot)"),
  costs: z.string().nullable().describe("Extra costs and who pays, e.g. 'buyer brings a helper for the stairs'"),
  extras: z.array(z.string()).describe("Things added to the deal, e.g. 'includes cushions'"),
  evidenceIds: z.array(z.string()).describe("Evidence ids that back up any claim in the message"),
  message: z.string().describe("At most two short sentences the other side will read"),
  askOwner: z
    .object({ question: z.string(), suggestedPrice: z.number().nullable() })
    .nullable()
    .describe("Only for ask_owner: a short question to your own owner"),
  reasoning: z.string().describe("Private note for your owner: why this move"),
  signalsUsed: z.array(z.string()).describe("Which counterparty signals influenced this move"),
  overLimitReason: z.string().nullable().describe("Only if your price goes past your owner's limit (within the stretch): why it's still a good deal, in one short line your owner will read"),
});
export type Move = z.infer<typeof Move>;

// Wraps a move in an A2A v1.0 message: a text part for people, a data part for code.
export function toA2AMessage(move: Move, from: string, contextId: string) {
  const { reasoning: _r, signalsUsed: _s, askOwner: _a, overLimitReason: _o, ...shared } = move;
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
