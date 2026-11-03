import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const PER_IP_PER_HOUR = 20;
const PER_DAY = Number(process.env.AI_DAILY_LIMIT ?? 1000); // the whole public site, per day
// Running on our own machine (next dev, scripts) has no caps; only the public site does.
const ON_OUR_MACHINE = process.env.NODE_ENV !== "production";

export class AiLimitError extends Error {}

// Recent call times per IP. One server instance, so memory is enough.
const callsByIp = new Map<string, number[]>();

const today = () => new Date().toISOString().slice(0, 10);

// Throws if this IP or the whole app has used its AI allowance.
export async function checkAiLimits(ip?: string) {
  if (ON_OUR_MACHINE) return;
  if (ip) {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = (callsByIp.get(ip) ?? []).filter((t) => t > hourAgo);
    if (recent.length >= PER_IP_PER_HOUR) {
      throw new AiLimitError("Too many AI requests. Try again in an hour.");
    }
    callsByIp.set(ip, [...recent, Date.now()]);
  }

  const [row] = await db.select().from(schema.aiUsage).where(eq(schema.aiUsage.day, today()));
  if ((row?.calls ?? 0) >= PER_DAY) {
    throw new AiLimitError("The demo's AI budget for today is used up. Try again tomorrow.");
  }
}

// Adds one call and its tokens to today's total.
export async function recordAiUsage(usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  await db
    .insert(schema.aiUsage)
    .values({ day: today(), calls: 1, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens })
    .onConflictDoUpdate({
      target: schema.aiUsage.day,
      set: {
        calls: sql`${schema.aiUsage.calls} + 1`,
        inputTokens: sql`${schema.aiUsage.inputTokens} + ${usage.input_tokens}`,
        outputTokens: sql`${schema.aiUsage.outputTokens} + ${usage.output_tokens}`,
      },
    });
  console.log("[ai] usage", usage.input_tokens, "in /", usage.output_tokens, "out", `/ cache ${usage.cache_read_input_tokens ?? 0} read, ${usage.cache_creation_input_tokens ?? 0} written`);
}
