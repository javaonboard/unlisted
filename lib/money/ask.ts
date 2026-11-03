import { or, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { claude, FALLBACK, MODELS } from "@/lib/ai/client";
import { checkAiLimits, recordAiUsage } from "@/lib/ai/limits";
import { connectPayPalTools } from "@/lib/paypal/toolkit";

// Everything this person paid or got paid on Unlisted.
export async function myMoney(userId: string) {
  const legs = await db.select().from(schema.dealLegs).where(or(eq(schema.dealLegs.payerId, userId), eq(schema.dealLegs.payeeId, userId)));
  const names = Object.fromEntries((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users)).map((u) => [u.id, u.name.split(" ")[0]]));
  return legs.map((l) => ({
    id: l.id,
    what: l.description,
    youPay: l.payerId === userId,
    other: names[l.payerId === userId ? l.payeeId : l.payerId],
    amount: Number(l.amount),
    deposit: l.deposit ? Number(l.deposit) : null,
    status: l.status,
    waitingForPaypalEmail: l.payeeId === userId && l.status === "captured" && !l.payoutBatchId,
    orderId: l.orderId,
  }));
}

// "Did Bella's payment go through?" The agent reads this person's payments and checks their
// PayPal orders live with PayPal's Agent Toolkit. It can only open their own orders.
export async function askAboutMoney(userId: string, question: string) {
  await checkAiLimits();
  const money = await myMoney(userId);
  const mine = new Set(money.map((m) => m.orderId).filter(Boolean));

  const paypal = await connectPayPalTools({ orders: { get: true } });
  try {
    const tools = paypal.tools.map((tool) => ({
      ...tool,
      run: async (input: { id?: string }, context?: unknown) =>
        input.id && mine.has(input.id) ? (tool.run as (i: unknown, c?: unknown) => unknown)(input, context) : "That order isn't one of theirs.",
    })) as typeof paypal.tools;

    const final = await claude().beta.messages.toolRunner({
      cache_control: { type: "ephemeral" }, // each step of the tool loop re-reads the conversation so far from cache
      model: MODELS.main,
      max_tokens: 1500,
      output_config: { effort: "low" },
      ...FALLBACK,
      tools,
      messages: [
        {
          role: "user",
          content: `You help someone understand their money on Unlisted, a local marketplace. PayPal holds a buyer's money until the handoff, then captures it and pays the seller (minus Unlisted's 8% fee). A rental also holds a deposit that's released when the item comes back.
Their payments:
${money.map((m) => `- ${m.what}: ${m.youPay ? `they pay ${m.other}` : `${m.other} pays them`} $${m.amount}${m.deposit ? ` + $${m.deposit} deposit` : ""}, status ${m.status}${m.orderId ? `, PayPal order ${m.orderId}` : ""}`).join("\n") || "- none yet"}
If the question is about whether money really moved, check the order with get_order. Only their order ids work.
Answer in 2-4 short, plain lines.

Their question: "${question}"`,
        },
      ],
    });
    await recordAiUsage(final.usage);
    return final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  } finally {
    await paypal.close();
  }
}
