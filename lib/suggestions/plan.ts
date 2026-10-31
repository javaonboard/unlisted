import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { suggest } from "./suggest";
import { inSentence } from "@/lib/text/words";

// Services that help a sale or purchase happen, and what to call a plan that uses one.
const HELPERS: Record<string, string> = { moving: "Moving day", "it-setup": "Upgrade day" };

// Someone selling one thing and buying another, maybe needing help to get it done:
// the agent offers to run it all as one plan, and says plainly what it will do.
export async function suggestPlan(userId: string) {
  const needs = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open")));
  const sell = needs.find((n) => n.type === "sell");
  const buy = needs.find((n) => n.type === "buy");
  const service = needs.find((n) => n.type === "request_service" && HELPERS[n.category]);
  if (!sell || !buy) return;
  const [plan] = await db.select().from(schema.deals).where(and(eq(schema.deals.ownerId, userId), ne(schema.deals.status, "cancelled")));
  if (plan) return;

  const [item] = await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.ownerId, userId), eq(schema.vaultItems.category, sell.category)));
  const what = item ? inSentence(item.title) : "item";
  const wanted = buy.text.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()); // "a smaller sofa under $250, ..."
  const helper = service?.text.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase());

  await suggest({
    userId,
    kind: "plan",
    title: `Run your sale, purchase${service ? " and " + (service.category === "moving" ? "move" : "setup") : ""} as one plan?`,
    body: [
      "Here's what I'll do:",
      "1. Talk to the best few buyers and sellers at the same time.",
      `2. Sell your ${what} only once ${wanted} is agreed.`,
      service ? `3. Once both are agreed, book ${helper} around those times.` : "3. Line up the times so the handoffs fit together.",
      "Nothing is final until you approve the plan, and PayPal only holds the money until each handoff. You can change what's in the plan first.",
    ].join("\n"),
    // What "Change the plan" offers to tick on or off.
    action: {
      title: service ? HELPERS[service.category] : "Swap",
      sellId: sell.id,
      sellText: `Sell your ${what}`,
      buyId: buy.id,
      buyText: `Buy ${wanted}`,
      serviceId: service?.id ?? "",
      serviceText: service ? `Book ${helper}` : "",
    },
  });
}
