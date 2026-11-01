import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";
import { findDemandFor, findSupplyFor } from "@/lib/matching/matcher";
import { distanceText } from "@/lib/places";
import { suggest } from "@/lib/suggestions/suggest";
import { asRecord } from "@/lib/vault/card";

const Plan = z.object({
  title: z.string().describe("Short name people use, e.g. 'Moving day', 'PC upgrade'"),
  sellItemIds: z.array(z.string()).describe("Their things to sell in the plan"),
  buyIds: z.array(z.string()).describe("Their needs to buy or rent in the plan"),
  helperIds: z.array(z.string()).describe("Their service needs that help it happen (mover, installer)"),
  sellWaitsForBuy: z.boolean(),
  steps: z.array(z.string()).describe("2-4 short first-person lines on what you'll do"),
});
const Idea = z.object({
  kind: z.enum(["go_public", "talk_to", "plan", "add_need", "set_price"]),
  title: z.string().describe("One short line, naming the thing and the people"),
  body: z.string().describe("One or two short sentences: why now, what you'll do"),
  button: z.string().describe("2-4 words, what tapping does, e.g. 'Make it public'"),
  itemId: z.string().nullable(),
  needId: z.string().nullable().describe("For talk_to: the other person's need id"),
  plan: Plan.nullable(),
  newNeed: z
    .object({
      type: z.enum(["buy", "rent", "request_service"]),
      text: z.string(),
      category: z.string(),
      maxPrice: z.number(),
      days: z.number().nullable(),
      requirements: z.array(z.object({ name: z.string(), value: z.number() })),
    })
    .nullable(),
  price: z.number().nullable().describe("For set_price: the new asking price"),
});

const QUIET = 2 * 60_000; // one look per person every couple of minutes at most

// The agent's look at one person's situation: their things, needs, deals and the market around them.
// It picks up to 3 suggestions worth their attention right now (a buyer for something private, a plan,
// a missing piece, a better price). Code checks every id, skips repeats, and keeps private things private.
export async function checkIn(userId: string, why: string) {
  const [me] = await db
    .update(schema.users)
    .set({ checkedInAt: new Date() })
    .where(and(eq(schema.users.id, userId), or(isNull(schema.users.checkedInAt), lt(schema.users.checkedInAt, new Date(Date.now() - QUIET)))))
    .returning();
  if (!me) return 0;

  const [things, needs, facts, recent, plans, users] = await Promise.all([
    db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.ownerId, userId), isNull(schema.vaultItems.soldAt))),
    db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open"))),
    db.select().from(schema.memoryFacts).where(eq(schema.memoryFacts.userId, userId)).orderBy(desc(schema.memoryFacts.confidence)).limit(6),
    db.select().from(schema.suggestions).where(and(eq(schema.suggestions.userId, userId), gte(schema.suggestions.createdAt, new Date(Date.now() - 14 * 86_400_000)))),
    db.select().from(schema.deals).where(and(eq(schema.deals.ownerId, userId), eq(schema.deals.isPlan, true), ne(schema.deals.status, "cancelled"))),
    db.select({ id: schema.users.id, name: schema.users.name, area: schema.users.area }).from(schema.users),
  ]);
  const who = (id: string) => users.find((u) => u.id === id);
  const talks = await db
    .select()
    .from(schema.negotiations)
    .where(and(or(eq(schema.negotiations.buyerId, userId), eq(schema.negotiations.sellerId, userId)), inArray(schema.negotiations.status, ["open", "waiting_owner", "agreed"])));

  // The market around them. Other people's private things only show as a count.
  const demand = await Promise.all(things.map(async (t) => ({ t, wants: (await findDemandFor(t.id)).filter((n) => !talks.some((r) => r.itemId === t.id && r.intentId === n.id)).slice(0, 3) })));
  const supply = await Promise.all(needs.filter((n) => n.type !== "sell").map(async (n) => ({ n, has: (await findSupplyFor(n.id)).slice(0, 5) })));

  const content = `You are ${me.name}'s agent on Unlisted, a local marketplace in ${me.area}, Austin. Something just happened: ${why}.
Look at their situation and suggest at most 3 things worth their attention right now, most useful first. Empty if nothing is worth it.
Kinds:
- go_public: one of their private things has people nearby who want it.
- talk_to: let you talk to one specific person who wants one of their things (needId = that person's need).
- plan: things that depend on each other: a sale that funds a purchase, a sale or purchase that needs a helper (mover, delivery, installer).
- add_need: something they'll clearly need but haven't asked for (e.g. a power supply for a new graphics card).
- set_price: a thing that isn't moving because the price is above what nearby people will pay.
Don't repeat recent suggestions, don't suggest what's already in progress, at most one of each kind, and use only the ids below.

About them: ${me.bio ?? "-"}
What you know: ${facts.map((f) => f.fact).join(" ") || "-"}

Their things:
${things.map((t) => `- ${t.id} | ${t.title} | ${t.kind} | ${t.openToOffers ? "public" : "private"}${t.estimatedValue ? ` | ~$${Number(t.estimatedValue).toFixed(0)}` : ""}${t.minPrice ? ` | lowest $${Number(t.minPrice).toFixed(0)}` : ""}${t.rentPerDay ? ` | rents $${Number(t.rentPerDay).toFixed(0)}/day` : ""}`).join("\n") || "- none"}

Who wants their things (not talking yet):
${demand.filter((d) => d.wants.length).map((d) => `- ${d.t.title}: ${d.wants.map((n) => `${who(n.ownerId)?.name.split(" ")[0]} (need ${n.id}, "${n.text}", budget $${n.maxPrice ?? "?"}, ${distanceText(me.area, who(n.ownerId)?.area ?? "")})`).join("; ")}`).join("\n") || "- nobody yet"}

Their needs:
${needs.map((n) => `- ${n.id} | ${n.type} | "${n.text}"${n.maxPrice ? ` | budget $${Number(n.maxPrice).toFixed(0)}` : ""}`).join("\n") || "- none"}

What's around for their needs:
${supply.map((s) => `- "${s.n.text}": ${s.has.filter((i) => i.openToOffers).length} open listings${s.has.length ? ` (${s.has.filter((i) => i.openToOffers).map((i) => `${i.title} ~$${Number(i.estimatedValue ?? 0).toFixed(0)}`).join(", ")})` : ""}, ${s.has.filter((i) => !i.openToOffers).length} private`).join("\n") || "- nothing"}

In progress: ${talks.length} deals${plans.length ? `, plan "${plans[0].title}" running` : ""}.
Recent suggestions: ${recent.map((s) => `${s.kind}: ${s.title} (${s.status})`).join("; ") || "none"}`;

  const { suggestions } = await askForData({ schema: z.object({ suggestions: z.array(Idea) }), model: MODELS.main, content });

  // Code decides what's allowed: ids must be theirs (or a real match), nothing repeated or already running.
  const mine = new Map(things.map((t) => [t.id, t]));
  const myNeeds = new Set(needs.map((n) => n.id));
  const already = (key: string) => recent.some((r) => JSON.stringify(r.action).includes(key) && (r.status !== "new" || r.kind !== "plan"));
  let sent = 0;
  // One of each kind per look, and a thing that's part of a suggested plan doesn't get its own suggestion.
  const inPlan = new Set(suggestions.flatMap((i) => (i.kind === "plan" && i.plan ? i.plan.sellItemIds : [])));
  const picked = suggestions.filter((idea, i) => suggestions.findIndex((x) => x.kind === idea.kind) === i && !(idea.kind !== "plan" && idea.itemId && inPlan.has(idea.itemId)));
  for (const idea of picked.slice(0, 3)) {
    const label = idea.button.slice(0, 30);
    const base = { userId, title: idea.title, body: idea.body };
    if (idea.kind === "go_public" && idea.itemId && mine.get(idea.itemId) && !mine.get(idea.itemId)!.openToOffers && !already(idea.itemId)) {
      sent += Number(await suggest({ ...base, kind: "go_public", action: { itemId: idea.itemId, label } }));
    } else if (idea.kind === "talk_to" && idea.itemId && idea.needId && demand.find((d) => d.t.id === idea.itemId)?.wants.some((n) => n.id === idea.needId) && !already(idea.needId)) {
      sent += Number(await suggest({ ...base, kind: "open_item", needId: idea.needId, action: { itemId: idea.itemId, needId: idea.needId, label } }));
    } else if (idea.kind === "plan" && idea.plan && !plans.length) {
      const p = idea.plan;
      const sells = p.sellItemIds.filter((id) => mine.has(id));
      const buys = p.buyIds.filter((id) => myNeeds.has(id));
      const helpers = p.helperIds.filter((id) => myNeeds.has(id));
      if (!sells.length && !buys.length) continue;
      const sellNeed = (itemId: string) => needs.find((n) => n.type === "sell" && n.category === mine.get(itemId)!.category)?.id;
      const text = (id: string) => needs.find((n) => n.id === id)?.text ?? "";
      const parts = [
        ...sells.map((itemId) => ({ kind: "sell", id: sellNeed(itemId) ?? `item:${itemId}`, itemId, text: `Sell your ${mine.get(itemId)!.title}` })),
        ...buys.map((id) => ({ kind: "buy", id, text: text(id) })),
        ...helpers.map((id) => ({ kind: "helper", id, text: text(id) })),
      ];
      await db.delete(schema.suggestions).where(and(eq(schema.suggestions.userId, userId), eq(schema.suggestions.kind, "plan"), eq(schema.suggestions.status, "new")));
      sent += Number(
        await suggest({
          ...base,
          kind: "plan",
          body: ["Here's what I'll do:", ...p.steps.map((s, i) => `${i + 1}. ${s}`), "Nothing is final until you approve each part, and PayPal only holds the money until each handoff."].join("\n"),
          action: { title: p.title, parts: JSON.stringify(parts), sellWaitsForBuy: p.sellWaitsForBuy ? 1 : 0, label },
        }),
      );
    } else if (idea.kind === "add_need" && idea.newNeed && !already(idea.newNeed.text)) {
      const n = idea.newNeed;
      sent += Number(await suggest({ ...base, kind: "post_need", action: { type: n.type, text: n.text, category: n.category, maxPrice: n.maxPrice, ...(n.days ? { days: n.days } : {}), constraints: JSON.stringify(asRecord(n.requirements)), label } }));
    } else if (idea.kind === "set_price" && idea.itemId && idea.price && mine.get(idea.itemId) && !already(`${idea.itemId}","price`)) {
      sent += Number(await suggest({ ...base, kind: "set_price", action: { itemId: idea.itemId, price: Math.round(idea.price), label } }));
    }
  }
  console.log(`[checkin] ${userId} (${why}): ${sent} suggestion(s)`);
  return sent;
}

// Once a day, everyone with things or needs gets a quiet review. A few people per tick keeps cost steady.
export async function dailyCheckIns() {
  const due = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(or(isNull(schema.users.checkedInAt), lt(schema.users.checkedInAt, new Date(Date.now() - 86_400_000))))
    .limit(5);
  for (const u of due) await checkIn(u.id, "the daily review");
}
