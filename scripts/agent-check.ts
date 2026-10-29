// Day-1 check: Claude answers a question using PayPal's Agent Toolkit tools.
//   npm run agent:check -- <orderId>
import { claude, MODELS, FALLBACK } from "@/lib/ai/client";
import { connectPayPalTools } from "@/lib/paypal/toolkit";

async function main() {
  const orderId = process.argv[2];
  const paypal = await connectPayPalTools();
  console.log("tools:", paypal.names.join(", "));

  const answer = await claude().beta.messages.toolRunner({
    model: MODELS.main,
    max_tokens: 4000,
    output_config: { effort: "low" },
    ...FALLBACK,
    tools: paypal.tools,
    messages: [
      {
        role: "user",
        content: `Check PayPal order ${orderId}. Who paid, how much, and is the money captured? Answer in two short lines.`,
      },
    ],
  });

  const text = answer.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  console.log("claude:", text);
  await paypal.close();
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
