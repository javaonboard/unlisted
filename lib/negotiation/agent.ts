import { askForData } from "@/lib/ai/structured";
import { checkMove } from "./guardrails";
import { Move } from "./moves";
import type { TurnContext } from "./context";
import { nextSaturday } from "@/lib/dates";

const system = (c: TurnContext) => `You are ${c.owner.name}'s agent on Unlisted, a local marketplace in Austin.
You act only for ${c.owner.name}, as the ${c.side}. Get a good deal that actually works in real life.

How to negotiate:
- Talk like a real neighbor, at most two short sentences. Be warm, a bit playful, never rude.
- Price is only one lever. Bargain over place (who drives where), time (fits the moving day?) and costs (stairs, helper, delivery, gas).
- Aim for your target, never pass your hard limit. If the other side is reasonable and a deal slightly past your limit would clearly help your owner, use ask_owner with a short question and a suggested price.
- Follow your owner's notes. They overrule everything else.
- Be honest: cite evidence ids for condition claims. Never invent defects, other offers or deadlines. Never reveal your limit.
- Read the signals about the other side for timing and framing. Never pressure or exploit anyone.
- Every offer names an exact time in slotStart (ISO): the handoff for goods, the job for services. Pick a time when both of you are free.
- Services: price by stops and effort.
- Accept when the other side's latest terms fit. Don't drag it out.`;

function describe(c: TurnContext) {
  const history = c.moves.length
    ? c.moves
        .map((m) => {
          const t = m.terms as { when?: string; place?: string; costs?: string };
          const who = m.fromUserId === c.owner.id ? "you" : c.other.name;
          return `- ${who}: ${m.kind}${m.price ? ` $${m.price}` : ""}${t.when ? `, ${t.when}` : ""}${t.place ? `, ${t.place}` : ""}${t.costs ? `, ${t.costs}` : ""}. "${m.note ?? ""}"`;
        })
        .join("\n")
    : "- nothing yet, you open.";

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const saturday = nextSaturday(9).toISOString();
  return `Today is ${today} (Austin time). This Saturday 9am is ${saturday}.
${c.item.kind === "skill" ? "Service" : "Item"}: ${c.item.title} (${c.item.condition ?? "no condition notes"}), est. value $${c.item.estimatedValue ?? "?"}.
Details: ${JSON.stringify(c.item.details)}
Evidence you may cite:
${c.evidence.map((e) => `- ${e.id}: ${e.summary} (${e.verified ? "verified" : "unverified claim"})`).join("\n") || "- none"}

Buyer's request: "${c.intent.text}". Buyer area: ${c.side === "buyer" ? c.owner.area : c.other.area}. Seller area: ${c.side === "seller" ? c.owner.area : c.other.area}.
Your target: $${c.limits.target}. Your hard limit: ${c.limits.role === "buyer" ? "pay at most" : "accept at least"} $${c.limits.limit}.
What you know about your owner:
${c.facts.map((f) => `- ${f.fact}`).join("\n") || "- nothing yet"}
${c.ownerTalk.length ? `\nYour owner's notes in this room:\n${c.ownerTalk.map((m) => `- ${m.kind === "ask_owner" ? "you asked" : "owner said"}: ${m.note}`).join("\n")}` : ""}
${c.plan.length ? `\nYour owner's whole plan (one linked deal): ${c.plan.join(" | ")}. If a mover is part of the plan, the mover handles transport.` : ""}
${c.legTerms.length ? `\nOther parts of the same deal:\n${c.legTerms.map((t) => `- ${t}`).join("\n")}` : ""}
${c.free.you.length ? `\nYour owner's free hours (pick a time inside them):\n${c.free.you.map((f) => `- ${f.startsAt.toISOString()} to ${f.endsAt.toISOString()}`).join("\n")}` : ""}
${c.free.them.length ? `\n${c.other.name}'s free hours (pick a time inside them):\n${c.free.them.map((f) => `- ${f.startsAt.toISOString()} to ${f.endsAt.toISOString()}`).join("\n")}` : ""}
${c.busy.length ? `\nBusy times (you or them):\n${c.busy.map((b) => `- ${b.startsAt.toISOString()} to ${b.endsAt.toISOString()}`).join("\n")}` : ""}

Signals about ${c.other.name}:
${c.signals.map((s) => `- ${s}`).join("\n") || "- none yet"}

Conversation so far (round ${c.room.round + 1} of ${c.room.maxRounds}):
${history}

Your move.`;
}

const walkAway: Move = {
  action: "walk_away",
  price: null,
  when: null,
  slotStart: null,
  place: null,
  costs: null,
  extras: [],
  evidenceIds: [],
  message: "Thanks, but I don't think we can make this one work.",
  askOwner: null,
  reasoning: "Could not find a move within your limits.",
  signalsUsed: [],
};

// Asks the agent for one move and checks it. One retry with the problem
// explained; if it still breaks the rules, the agent walks away.
export async function decideMove(c: TurnContext): Promise<Move> {
  const rules = {
    limits: c.limits,
    evidenceIds: c.evidence.map((e) => e.id),
    standingPrice: c.standingPrice,
    alreadyAsked: c.alreadyAsked,
    busy: c.busy,
    free: [c.free.you, c.free.them],
  };
  let content = describe(c);

  for (let attempt = 0; attempt < 2; attempt++) {
    const move = await askForData({ schema: Move, system: system(c), content });
    const problem = checkMove(move, rules);
    if (!problem) return move;
    console.warn("[agent] move rejected:", problem);
    content += `\n\nYour last move was not allowed: ${problem} Try again.`;
  }
  return walkAway;
}
