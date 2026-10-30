import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type NewItem = {
  kind: "goods" | "skill";
  title: string;
  category: string;
  condition?: string;
  estimatedValue?: number;
  minPrice?: number;
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
    })
    .returning();
  return row;
}

// A small thumbnail so the card shows the photo it came from.
export async function setPhoto(itemId: string, dataUrl: string) {
  await db.update(schema.vaultItems).set({ photos: [dataUrl] }).where(eq(schema.vaultItems.id, itemId));
}
