import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  main: "claude-sonnet-5-5", // negotiation, vision, intents
  small: "claude-haiku-4-5", // fact extraction, ranking
} as const;

// Lets the API retry on another model if a request is refused.
export const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

let client: Anthropic | undefined;

export function claude(): Anthropic {
  client ??= new Anthropic();
  return client;
}
