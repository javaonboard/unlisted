import { z } from "zod";

// A card the owner checks before saving. Shared by the server and the "Tell your agent" box.
export const Card = z.object({
  kind: z.enum(["goods", "skill", "need"]).describe("goods: something they own. skill: a service they can offer. need: something they want"),
  title: z.string().describe("Short title, e.g. 'Mountain bike, size L' or 'Wi-Fi setup'"),
  category: z.string().describe("Lowercase slug, e.g. sofa, bike, tools, gpu, moving, gutters, lawn, car-care, it-setup, washing"),
  details: z.string().nullable().describe("Useful specifics they gave: size, model, job size, where. Null if none"),
  condition: z.string().nullable().describe("Goods only: condition in their words"),
  value: z.number().nullable().describe("Goods: rough used value. Skill: their price per job. USD"),
  minPrice: z.number().nullable().describe("Goods only: the lowest price they said they'd take. 0 if they said any offer is fine"),
  freeHours: z.array(z.object({ start: z.string(), end: z.string() })).describe("Skill only: when they said they're free, as ISO times within the next 7 days. Empty if not said"),
  maxMiles: z.number().nullable().describe("How far they'll go, in miles: a provider's service area, how far a seller will deliver (0 = pickup only), or how far away is fine for a need. Null if not said"),
  needType: z.enum(["buy", "request_service"]).nullable().describe("Needs only"),
  maxPrice: z.number().nullable().describe("Needs only: their budget, if they said one"),
  dueInDays: z.number().nullable().describe("Needs only: days from today until it must be done, at least 1 (\"this weekend\" on a Friday is 2), if they said when"),
});
export type Card = z.infer<typeof Card>;

// What a card can't go without. Needs get a budget so the agent always has a spending limit;
// sales get a lowest price so the agent never sells too cheap.
export function missing(c: Card) {
  if (c.kind === "need") return [c.maxPrice === null && "budget", c.dueInDays === null && "when"].filter(Boolean) as string[];
  if (c.kind === "goods") return [!c.condition && "condition", c.minPrice === null && "lowest price"].filter(Boolean) as string[];
  return [c.value === null && "price per job", !c.freeHours.length && "when you're free"].filter(Boolean) as string[];
}
