import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { composePlan } from "@/lib/plans/compose";
import { suggest } from "./suggest";
import { asRecord } from "@/lib/vault/card";

// Asks the planning agent whether someone's needs belong together. If so, the Inbox gets
// one plan suggestion in the agent's own words, plus a "you'll also need…" suggestion per gap.
export async function suggestPlan(userId: string, change?: string) {
  const [running] = await db.select().from(schema.deals).where(and(eq(schema.deals.ownerId, userId), ne(schema.deals.status, "cancelled")));
  if (running) return;
  const plan = await composePlan(userId, change);
  if (!plan) return;

  const needs = await db.select().from(schema.intents).where(inArray(schema.intents.id, [...plan.sells.map((s) => s.needId), ...plan.buyIds, ...plan.helperIds]));
  const text = (id: string) => needs.find((n) => n.id === id)?.text ?? "";
  // What "Change the plan" lets them tick on or off.
  const parts = [
    ...plan.sells.map((s) => ({ kind: "sell", id: s.needId, itemId: s.itemId, text: text(s.needId) })),
    ...plan.buyIds.map((id) => ({ kind: "buy", id, text: text(id) })),
    ...plan.helperIds.map((id) => ({ kind: "helper", id, text: text(id) })),
  ];

  // The latest plan replaces an unanswered older one.
  await db.delete(schema.suggestions).where(and(eq(schema.suggestions.userId, userId), eq(schema.suggestions.kind, "plan"), eq(schema.suggestions.status, "new")));
  await suggest({
    userId,
    kind: "plan",
    title: plan.question,
    body: [
      "Here's what I'll do:",
      ...plan.steps.map((s, i) => `${i + 1}. ${s}`),
      "Nothing is final until you approve the plan, and PayPal only holds the money until each handoff. You can change what's in the plan first.",
    ].join("\n"),
    action: { title: plan.title, parts: JSON.stringify(parts), sellWaitsForBuy: plan.sellWaitsForBuy ? 1 : 0, label: "Start the plan" },
  });

  for (const gap of plan.missing) {
    await suggest({
      userId,
      kind: "post_need",
      title: `Add “${gap.text}” to your plan?`,
      body: `${gap.why.replace(/\.+$/, "")}. I'd look for one up to $${gap.maxPrice}.`,
      action: { type: gap.type, text: gap.text, category: gap.category, maxPrice: gap.maxPrice, constraints: JSON.stringify(asRecord(gap.requirements)), label: "Add it" },
    });
  }
}
