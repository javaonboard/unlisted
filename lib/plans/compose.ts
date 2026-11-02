import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db, schema } from "@/lib/db";
import { claude, FALLBACK, MODELS } from "@/lib/ai/client";
import { checkAiLimits, recordAiUsage } from "@/lib/ai/limits";
import { lookUpProduct } from "@/lib/items/products";
import { categoryRule, knownCategories } from "@/lib/items/categories";

const Plan = z.object({
  worthIt: z.boolean().describe("True only if some of these needs really depend on each other"),
  title: z.string().describe("Short name people use for this situation, e.g. 'Moving day', 'PC upgrade', 'Nursery makeover'"),
  question: z.string().describe("One short question offering the plan, e.g. 'Plan your moving day as one?'"),
  sells: z.array(z.object({ needId: z.string(), itemId: z.string() })).describe("Sales in the plan, each with the owner's item being sold"),
  buyIds: z.array(z.string()).describe("Purchases in the plan (need ids)"),
  helperIds: z.array(z.string()).describe("Services that help the goods change hands or get set up, e.g. a mover or installer (need ids)"),
  sellWaitsForBuy: z.boolean().describe("True if the person should only sell once the purchase is agreed"),
  steps: z.array(z.string()).describe("2-4 short lines saying what you'll do, in plain words, first person"),
  missing: z
    .array(z.object({
      type: z.enum(["buy", "request_service"]),
      text: z.string().describe("The need in plain words, e.g. 'A 650W+ power supply'"),
      category: z.string().describe("Lowercase slug, e.g. psu, moving, it-setup"),
      maxPrice: z.number().describe("A fair used-market budget in USD"),
      why: z.string().describe("One short reason, e.g. 'A 4070 needs 650W and your PC has 550W'"),
      requirements: z.array(z.object({ name: z.string(), value: z.number() })).describe("Number limits as minX / maxX, e.g. minWatts 650. Empty if none"),
    }))
    .describe("At most 2 things they'll clearly need to get this done but haven't asked for. Empty if none"),
});
type ComposedPlan = z.infer<typeof Plan>;

// The planning agent: looks at someone's open needs, their things and what it knows about them,
// checks real products when specs matter, and proposes one plan. Code checks the ids it returns.
export async function composePlan(userId: string, change?: string): Promise<ComposedPlan | null> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const [needs, items, facts] = await Promise.all([
    db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open"))),
    db.select().from(schema.items).where(eq(schema.items.ownerId, userId)),
    db.select().from(schema.memoryFacts).where(eq(schema.memoryFacts.userId, userId)).orderBy(desc(schema.memoryFacts.confidence)).limit(6),
  ]);
  if (needs.length < 2 || !needs.some((n) => n.type === "sell" || n.type === "buy")) return null;

  await checkAiLimits();
  let plan: ComposedPlan | null = null;
  const runner = claude().beta.messages.toolRunner({
    model: MODELS.main,
    max_tokens: 3000,
    output_config: { effort: "low" },
    ...FALLBACK,
    tools: [
      betaZodTool({
        name: "look_up_product",
        description: "Look up real products by name to check specs or prices, e.g. 'RTX 4070 power requirement' or 'loveseat dimensions'.",
        inputSchema: z.object({ query: z.string() }),
        run: async ({ query }) => JSON.stringify(await lookUpProduct(query).catch(() => [])),
      }),
      betaZodTool({
        name: "submit_plan",
        description: "Submit the plan. Call this once, at the end.",
        inputSchema: Plan,
        run: async (input) => {
          plan = input;
          return "Saved.";
        },
      }),
    ],
    messages: [
      {
        role: "user",
        content: `You are ${user.name}'s agent on Unlisted, a local marketplace in ${user.area}, Austin.
Decide whether some of their needs belong in one plan: a sale, a purchase, and help to make it happen (moving, delivery, setup).
A plan runs the talks together and books helpers around the agreed handoffs. Only plan needs that truly depend on each other.
If specs matter (power, size, fit), look the products up first. Point out at most 2 things they'll clearly need but haven't asked for.
${categoryRule(await knownCategories())}
Use only the ids below. Then call submit_plan.${change ? `

They asked you to change the plan: "${change}". Follow that. If it needs something they haven't asked for yet (a cleaner, a second item), put it in missing.` : ""}

Their open needs:
${needs.map((n) => `- ${n.id} | ${n.type} | ${n.category} | "${n.text}"${n.maxPrice ? ` | up to $${n.maxPrice}` : ""}`).join("\n")}

Their things:
${items.map((i) => `- ${i.id} | ${i.kind} | ${i.category} | ${i.title}${i.condition ? ` (${i.condition})` : ""}`).join("\n") || "- none"}

About them, in their own words: ${user.bio ?? "-"}
What you know about them:
${facts.map((f) => `- ${f.fact}`).join("\n") || "- nothing yet"}`,
      },
    ],
  });
  const final = await runner;
  await recordAiUsage(final.usage);
  if (!plan) return null;

  // Keep only ids that are really theirs.
  const p = plan as ComposedPlan;
  const needIds = new Set(needs.map((n) => n.id));
  const itemIds = new Set(items.map((i) => i.id));
  const typeOf = (id: string) => needs.find((n) => n.id === id)?.type;
  const clean: ComposedPlan = {
    ...p,
    sells: p.sells.filter((s) => typeOf(s.needId) === "sell" && itemIds.has(s.itemId)),
    buyIds: p.buyIds.filter((id) => needIds.has(id) && typeOf(id) === "buy"),
    helperIds: p.helperIds.filter((id) => needIds.has(id) && typeOf(id) === "request_service"),
    missing: p.missing.slice(0, 2),
  };
  console.log(`[plan] ${userId}: ${clean.worthIt ? clean.title : "no plan"} · ${clean.sells.length} sell, ${clean.buyIds.length} buy, ${clean.helperIds.length} helper, ${clean.missing.length} missing`);
  return clean.worthIt && clean.sells.length + clean.buyIds.length > 0 ? clean : null;
}
