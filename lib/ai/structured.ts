import type { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, MODELS } from "./client";
import { checkAiLimits, recordAiUsage } from "./limits";

type Options<T extends z.ZodType> = {
  schema: T;
  system?: string;
  content: Anthropic.MessageParam["content"];
  model?: (typeof MODELS)[keyof typeof MODELS];
  ip?: string;
};

// One Claude call that returns data matching the schema.
// Every call goes through the AI limits and is counted.
export async function askForData<T extends z.ZodType>(options: Options<T>): Promise<z.infer<T>> {
  await checkAiLimits(options.ip);

  const message = await claude().messages.parse({
    model: options.model ?? MODELS.main,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(options.schema) },
    system: options.system,
    messages: [{ role: "user", content: options.content }],
  });

  await recordAiUsage(message.usage);
  if (!message.parsed_output) throw new Error(`AI returned no data: ${message.stop_reason}`);
  return message.parsed_output;
}
