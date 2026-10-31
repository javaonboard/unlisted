import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { placesInReach, rangeOfNeed, rangeOfOffer } from "@/lib/places";
import { meetsRequirements } from "./rules";

type Item = typeof schema.vaultItems.$inferSelect;
type Intent = typeof schema.intents.$inferSelect;

// Hard rules first: same category, prices overlap, and the need's requirements hold.
// Requirements are generic: "minSeats: 3" needs the item's "seats" ≥ 3, "maxWidthIn: 80" needs
// "widthIn" ≤ 80. The AI names the specs when it reads a photo or a message; this rule just compares them.
function fits(item: Item, intent: Intent) {
  if (item.category !== intent.category || item.ownerId === intent.ownerId) return false;
  if (intent.type === "buy" && item.kind === "goods" && !item.forSale) return false;
  if (intent.type === "rent" && !item.rentPerDay) return false;
  // Within 10% is still worth talking about; owners can stretch. A rental costs its daily price times the days.
  const ask = intent.type === "rent" ? Number(item.rentPerDay) * (intent.days ?? 1) : Number(item.minPrice ?? 0);
  if (ask && intent.maxPrice && ask > Number(intent.maxPrice) * 1.1) return false;
  return meetsRequirements(item.details as Record<string, unknown>, intent.constraints as Record<string, unknown>);
}


// Both people can meet somewhere without driving past how far they said they'd go.
async function inReach() {
  const users = await db.select({ id: schema.users.id, area: schema.users.area }).from(schema.users);
  const area = (id: string) => users.find((u) => u.id === id)?.area ?? "";
  return (item: Item, intent: Intent) =>
    placesInReach({ buyerArea: area(intent.ownerId), sellerArea: area(item.ownerId), buyerMiles: rangeOfNeed(intent.maxMiles), sellerMiles: rangeOfOffer(item.maxMiles) }).length > 0;
}

// Open buy or service requests that this item or skill could fill.
export async function findDemandFor(itemId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
  // A service answers service requests; goods answer people buying or renting.
  const types = item.kind === "skill" ? ["request_service" as const] : ["buy" as const, "rent" as const];
  const intents = await db
    .select()
    .from(schema.intents)
    .where(and(inArray(schema.intents.type, types), eq(schema.intents.status, "open"), ne(schema.intents.ownerId, item.ownerId)));
  const reach = await inReach();
  return intents.filter((intent) => fits(item, intent) && reach(item, intent));
}

// Items or skills that could fill this request. Private items count too:
// their owners get asked before anything is shown.
export async function findSupplyFor(intentId: string) {
  const [intent] = await db.select().from(schema.intents).where(eq(schema.intents.id, intentId));
  const kind = intent.type === "request_service" ? "skill" : "goods";
  const items = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.kind, kind));
  const reach = await inReach();
  return items.filter((item) => fits(item, intent) && reach(item, intent));
}
