import { and, eq } from "drizzle-orm";
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
  maxMiles?: number;
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
      maxMiles: item.maxMiles,
    })
    .returning();
  await publish("vault.added", { itemId: row.id });
  return row;
}

// A small thumbnail so the card shows the photo it came from.
export async function setPhoto(itemId: string, dataUrl: string) {
  await db.update(schema.vaultItems).set({ photos: [dataUrl] }).where(eq(schema.vaultItems.id, itemId));
}

// How far the owner will travel for this item or service. Only the owner can change it.
export async function setItemRange(ownerId: string, itemId: string, miles: number) {
  await db.update(schema.vaultItems).set({ maxMiles: Math.max(0, Math.round(miles)) }).where(and(eq(schema.vaultItems.id, itemId), eq(schema.vaultItems.ownerId, ownerId)));
}

// The owner edits anything about their item or service. Prices stay theirs to set.
export async function updateItem(ownerId: string, itemId: string, f: { title?: string; condition?: string; estimatedValue?: number; minPrice?: number; openToOffers?: boolean }) {
  await db
    .update(schema.vaultItems)
    .set({
      ...(f.title ? { title: f.title } : {}),
      condition: f.condition || null,
      ...(f.estimatedValue !== undefined ? { estimatedValue: f.estimatedValue.toFixed(2) } : {}),
      ...(f.minPrice !== undefined ? { minPrice: f.minPrice.toFixed(2) } : {}),
      ...(f.openToOffers !== undefined ? { openToOffers: f.openToOffers } : {}),
    })
    .where(and(eq(schema.vaultItems.id, itemId), eq(schema.vaultItems.ownerId, ownerId)));
}
