import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { suggest } from "./suggest";

// Someone selling one thing, buying its replacement and maybe needing help to move:
// the agent offers to run it all as one plan, and says plainly what it will do.
export async function suggestPlan(userId: string) {
  const needs = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open")));
  const sell = needs.find((n) => n.type === "sell");
  const buy = needs.find((n) => n.type === "buy");
  const mover = needs.find((n) => n.type === "request_service");
  if (!sell || !buy) return;
  const [plan] = await db.select().from(schema.deals).where(and(eq(schema.deals.ownerId, userId), ne(schema.deals.status, "cancelled")));
  if (plan) return;
  const [item] = await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.ownerId, userId), eq(schema.vaultItems.category, sell.category)));
  const wanted = buy.text.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()); // "a smaller sofa under $250, ..."

  await suggest({
    userId,
    kind: "plan",
    title: "Run your sale, purchase and move as one plan?",
    body: [
      "Here's what I'll do:",
      "1. Talk to the best few buyers and sellers at the same time.",
      `2. Sell your ${item?.title.toLowerCase() ?? "item"} only once ${wanted} is agreed.`,
      mover ? "3. Once both are agreed, book a mover for both pickups around those times." : "3. Line up the times so the handoffs fit together.",
      "Nothing is final until you approve the plan, and PayPal only holds the money until each handoff.",
    ].join("\n"),
    action: { title: "Moving day" },
  });
}
