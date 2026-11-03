import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db, schema } from "@/lib/db";
import { claude, FALLBACK, MODELS } from "@/lib/ai/client";
import { checkAiLimits, recordAiUsage } from "@/lib/ai/limits";
import { lookUpProduct } from "@/lib/items/products";

const Price = z.object({
  newPrice: z.number().nullable().describe("Typical price new, USD, if it applies"),
  usedLow: z.number().describe("Low end of recent used prices (or local rates for a service), USD"),
  usedHigh: z.number().describe("High end, USD"),
  suggested: z.number().describe("A fair price for this one, given its condition and the area, USD"),
  note: z.string().describe("One short line on why, in plain words"),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).describe("Up to 4 pages you used"),
});
export type PriceCheck = z.infer<typeof Price> & { checkedAt: string };

// What it sold for on Unlisted: agreed deals in the same category. Our own market, and the most local data.
async function soldHere(category: string) {
  const rows = await db
    .select({ price: schema.negotiations.agreedPrice, title: schema.items.title, condition: schema.items.condition })
    .from(schema.negotiations)
    .innerJoin(schema.items, eq(schema.items.id, schema.negotiations.itemId))
    .where(and(eq(schema.negotiations.status, "agreed"), eq(schema.items.category, category)))
    .limit(8);
  return rows.map((r) => `$${Number(r.price).toFixed(0)}: ${r.title}${r.condition ? ` (${r.condition})` : ""}`);
}

// A price check from three places: live web search, Channel3 for the new price, and deals done on Unlisted.
// It's advice with sources; the owner can always set their own price.
export async function checkPrice(thing: { title: string; condition?: string | null; category: string; kind: "goods" | "service" | "budget"; area: string }) {
  await checkAiLimits();
  const local = await soldHere(thing.category);
  let result: z.infer<typeof Price> | null = null;

  const final = await claude().beta.messages.toolRunner({
    cache_control: { type: "ephemeral" }, // each step of the tool loop re-reads the conversation so far from cache
    model: MODELS.main,
    max_tokens: 3000,
    output_config: { effort: "low" },
    ...FALLBACK,
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 5 },
      betaZodTool({
        name: "look_up_product",
        description: "Look up the product's new retail price and specs.",
        inputSchema: z.object({ query: z.string() }),
        run: async ({ query }) => JSON.stringify(await lookUpProduct(query).catch(() => [])),
      }),
      betaZodTool({
        name: "submit_price",
        description: "Submit the price check. Call once, at the end.",
        inputSchema: Price,
        run: async (input) => {
          result = input;
          return "Saved.";
        },
      }),
    ],
    messages: [
      {
        role: "user",
        content: `Find a fair price in ${thing.area}, Austin, TX.
${thing.kind === "service" ? `A local service, priced per job: "${thing.title}".` : thing.kind === "budget" ? `Someone wants to buy: "${thing.title}". What should they budget, used?` : `Used, for sale: "${thing.title}"${thing.condition ? `, condition: ${thing.condition}` : ""}.`}
Always start with a web search for recent used prices or local rates. Then look up the new price.
Use pages that actually show prices: eBay sold listings, resale price guides, cost guides for services.
Marketplace search pages (Facebook, Craigslist, OfferUp) usually don't show prices in results, so don't rely on them. One search at a time.
Put every page you took a price from in sources (title and url), so the owner can check it.
Sold on Unlisted in this category: ${local.length ? local.join("; ") : "nothing yet"}.
Then call submit_price.`,
      },
    ],
  });
  await recordAiUsage(final.usage);
  if (!result) return null;
  console.log(`[price] ${thing.title}: ~$${(result as z.infer<typeof Price>).suggested}`);
  return { ...(result as z.infer<typeof Price>), checkedAt: new Date().toISOString() } satisfies PriceCheck;
}
