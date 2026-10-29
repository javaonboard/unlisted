import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type Item = typeof schema.vaultItems.$inferSelect;
type Intent = typeof schema.intents.$inferSelect;

// Hard rules first: same category, prices overlap, size fits.
function fits(item: Item, intent: Intent) {
  if (item.category !== intent.category || item.ownerId === intent.ownerId) return false;
  if (item.minPrice && intent.maxPrice && Number(item.minPrice) > Number(intent.maxPrice)) return false;

  const wanted = intent.constraints as { minSeats?: number; maxWidthIn?: number };
  const details = item.details as { seats?: number; widthIn?: number };
  if (wanted.minSeats && (details.seats ?? 0) < wanted.minSeats) return false;
  if (wanted.maxWidthIn && (details.widthIn ?? Infinity) > wanted.maxWidthIn) return false;
  return true;
}

// Open buy or service requests that this item or skill could fill.
export async function findDemandFor(itemId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
  const type = item.kind === "skill" ? "request_service" : "buy";
  const intents = await db
    .select()
    .from(schema.intents)
    .where(and(eq(schema.intents.type, type), eq(schema.intents.status, "open"), ne(schema.intents.ownerId, item.ownerId)));
  return intents.filter((intent) => fits(item, intent));
}

// Items or skills that could fill this request. Private items count too:
// their owners get asked before anything is shown.
export async function findSupplyFor(intentId: string) {
  const [intent] = await db.select().from(schema.intents).where(eq(schema.intents.id, intentId));
  const kind = intent.type === "request_service" ? "skill" : "goods";
  const items = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.kind, kind));
  return items.filter((item) => fits(item, intent));
}
