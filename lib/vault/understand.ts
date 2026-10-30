import { z } from "zod";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";

export const Card = z.object({
  kind: z.enum(["goods", "skill", "need"]).describe("goods: something they own. skill: a service they can offer. need: something they want"),
  title: z.string().describe("Short title, e.g. 'Mountain bike, size L' or 'Wi-Fi setup'"),
  category: z.string().describe("Lowercase slug, e.g. sofa, bike, tools, gpu, moving, gutters, lawn, car-care, it-setup, washing"),
  condition: z.string().nullable().describe("Goods only: condition in their words"),
  value: z.number().nullable().describe("Goods: rough used value. Skill: typical price per job. USD"),
  needType: z.enum(["buy", "request_service"]).nullable().describe("Needs only"),
  maxPrice: z.number().nullable().describe("Needs only, if they said a budget"),
  dueInDays: z.number().nullable().describe("Needs only, if they said when"),
});
export type Card = z.infer<typeof Card>;

// "I have a ladder and free Saturdays" → a card the owner can check and save.
export async function understandText(text: string, ip?: string) {
  return askForData({
    schema: z.object({ cards: z.array(Card).describe("One card per thing they mentioned, at most three") }),
    model: MODELS.small,
    ip,
    content: `A person told their marketplace agent: "${text}". Turn it into cards. Don't invent details they didn't say.`,
  });
}
