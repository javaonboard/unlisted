import { z } from "zod";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";
import { Card, missing } from "./card";
import { categoryRule, knownCategories } from "./categories";

// "I have a ladder and free Saturdays" → cards to check, plus one short question if something is missing.
// The owner's answers are added to the same text and it runs again.
export async function understandText(text: string, ip?: string) {
  const now = new Date();
  const { cards, question } = await askForData({
    schema: z.object({
      cards: z.array(Card).describe("One card per thing they mentioned, at most three"),
      question: z.string().nullable().describe("One short, friendly question asking for what's missing, or null"),
    }),
    model: MODELS.small,
    ip,
    content: `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${now.toISOString()}), Austin time.
A person told their marketplace agent: "${text}"
Turn it into cards. Don't invent details they didn't say.
${categoryRule(await knownCategories())}
Must-haves: needs → budget and when (and for how many days if they only need it for a while: that's a rent need); goods to sell → condition and lowest price; goods to rent out → price per day (and a deposit); services they offer → price per job and when they're free.
Goods can be for sale, for rent, or both: suggest renting for tools and gear people borrow for a day or two.
For a service they need, also ask about the job size if it isn't clear (e.g. how big the yard, one or two stories).
Also ask how far they'll travel (or deliver, or how far away is fine) if they didn't say, in the same question.
If anything is missing, ask for all of it in one short question. Otherwise question is null.`,
  });
  const gaps = cards.flatMap(missing);
  return { cards, question: question ?? (gaps.length ? `Quick question: ${gaps.join(", ")}?` : null) };
}
