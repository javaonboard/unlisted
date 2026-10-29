import { askForData } from "@/lib/ai/structured";
import { checkMove } from "./guardrails";
import { Move } from "./moves";
import type { TurnContext } from "./context";

const system = (c: TurnContext) => `You are ${c.owner.name}'s negotiating agent on Unlisted, a local marketplace.
You act only for ${c.owner.name}, as the ${c.side}. Goal: a fair deal, quickly.

Rules:
- Stay within your owner's limit. Never reveal the limit.
- Be honest. Cite evidence ids for any claim about condition. Never invent defects, other offers or deadlines.
- Use the signals about the other side to pick timing and framing (for example offer a fast pickup to someone in a hurry). Never pressure or exploit anyone.
- Negotiate more than price when it helps: pickup time, extras, bundling.
- Accept when the other side's latest price is within your limit and fair. Keep messages short and friendly.`;

function describe(c: TurnContext) {
  const item = c.item;
  const history = c.moves.length
    ? c.moves
        .map((m) => `- round ${m.round}, ${m.fromUserId === c.owner.id ? "you" : c.other.name}: ${m.kind}${m.price ? ` $${m.price}` : ""}. "${m.note ?? ""}"`)
        .join("\n")
    : "- nothing yet, you open.";

  return `Item: ${item.title} (${item.condition ?? "condition not stated"}), est. value $${item.estimatedValue ?? "?"}.
Details: ${JSON.stringify(item.details)}
Evidence you may cite:
${c.evidence.map((e) => `- ${e.id}: ${e.summary} (${e.verified ? "verified" : "unverified claim"})`).join("\n") || "- none"}

Buyer's request: "${c.intent.text}"
Your limit: ${c.limits.role === "buyer" ? "pay at most" : "accept at least"} $${c.limits.limit}.
What you know about your owner:
${c.facts.map((f) => `- ${f.fact}`).join("\n") || "- nothing yet"}

Signals about ${c.other.name}:
${c.signals.map((s) => `- ${s}`).join("\n") || "- none yet"}

Room so far (round ${c.room.round + 1} of ${c.room.maxRounds}):
${history}

Make your next move.`;
}

// Asks the agent for one move and checks it. One retry with the problem
// explained; if it still breaks the rules, the agent walks away.
export async function decideMove(c: TurnContext): Promise<Move> {
  const evidenceIds = c.evidence.map((e) => e.id);
  let content = describe(c);

  for (let attempt = 0; attempt < 2; attempt++) {
    const move = await askForData({ schema: Move, system: system(c), content });
    const problem = checkMove(move, c.limits, evidenceIds, c.standingPrice);
    if (!problem) return move;
    console.warn("[agent] move rejected:", problem);
    content += `\n\nYour last move was not allowed: ${problem} Try again.`;
  }

  return {
    action: "walk_away",
    price: null,
    pickup: null,
    extras: [],
    evidenceIds: [],
    message: "Thanks, but I don't think we can make this work.",
    reasoning: "Could not find a move within your limits.",
    signalsUsed: [],
  };
}
