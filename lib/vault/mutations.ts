import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { publish } from "@/lib/events/bus";

type NewItem = {
  kind: "goods" | "skill";
  title: string;
  category: string;
  condition?: string;
  estimatedValue?: number;
  minPrice?: number;
  openToOffers?: boolean;
  details?: Record<string, unknown>;
};

// New things start private. Nobody sees them until the owner says yes to a buyer.
export async function addVaultItem(ownerId: string, item: NewItem) {
  const [row] = await db
    .insert(schema.vaultItems)
    .values({
      ownerId,
      kind: item.kind,
      title: item.title,
      category: item.category,
      condition: item.condition,
      estimatedValue: item.estimatedValue?.toFixed(2),
      minPrice: item.minPrice?.toFixed(2),
      openToOffers: item.openToOffers ?? false,
      details: item.details ?? {},
    })
    .returning();
  await publish("vault.added", { itemId: row.id });
  return row;
}

// A small thumbnail so the card shows the photo it came from.
export async function setPhoto(itemId: string, dataUrl: string) {
  await db.update(schema.vaultItems).set({ photos: [dataUrl] }).where(eq(schema.vaultItems.id, itemId));
}
