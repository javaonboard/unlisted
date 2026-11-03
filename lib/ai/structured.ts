import type { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, FALLBACK, MODELS } from "./client";
import { checkAiLimits, recordAiUsage } from "./limits";

type Options<T extends z.ZodType> = {
  schema: T;
  system?: string;
  content: Anthropic.Beta.BetaMessageParam["content"];
  model?: (typeof MODELS)[keyof typeof MODELS];
  ip?: string;
};

// One Claude call that returns data matching the schema.
// Every call goes through the AI limits and is counted.
export async function askForData<T extends z.ZodType>(options: Options<T>): Promise<z.infer<T>> {
  await checkAiLimits(options.ip);

  const model = options.model ?? MODELS.main;
  const message = await claude().beta.messages.parse({
    model,
    max_tokens: 4000,
    // Haiku does not take an effort setting. The main model can fall back to another if a request is refused.
    ...(model === MODELS.small
      ? { output_config: { format: betaZodOutputFormat(options.schema) } }
      : { output_config: { effort: "low" as const, format: betaZodOutputFormat(options.schema) }, ...FALLBACK }),
    // A system prompt is our fixed instructions: cached so repeated calls (every negotiation turn) read it cheaply.
    system: options.system ? [{ type: "text" as const, text: options.system, cache_control: { type: "ephemeral" as const } }] : undefined,
    messages: [{ role: "user", content: options.content }],
  });

  await recordAiUsage(message.usage);
  if (!message.parsed_output) throw new Error(`AI returned no data: ${message.stop_reason}`);
  return message.parsed_output;
}
