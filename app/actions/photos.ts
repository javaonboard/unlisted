"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { inspectItem } from "@/lib/items/inspect";
import { priceItem } from "@/lib/pricing/save";
import { AiLimitError } from "@/lib/ai/limits";

const MAX_PHOTOS = 4;

// The owner adds photos (or frames from a video). Their agent checks them, then re-checks the price.
export async function addPhotosAction(itemId: string, checks: string[], thumbs: string[], video: boolean): Promise<string | null> {
  const userId = await currentUserId();
  const [item] = await db.select().from(schema.items).where(and(eq(schema.items.id, itemId), eq(schema.items.ownerId, userId)));
  if (!item) return "That isn't yours.";
  if (!checks.length || checks.some((c) => !c.startsWith("data:image/jpeg;base64,"))) return "Couldn't read that file.";

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  try {
    const seen = await inspectItem(itemId, checks, video, ip);
    if (!seen.matches) return `That doesn't look like your ${item.title.toLowerCase()}${seen.mismatch ? `: ${seen.mismatch}` : ""}.`;
    await db.update(schema.items).set({ photos: [...thumbs, ...item.photos].slice(0, MAX_PHOTOS) }).where(eq(schema.items.id, itemId));
    after(() => priceItem(itemId).then(() => {}).catch((e) => console.error("[price] failed", e?.message)));
  } catch (error) {
    return error instanceof AiLimitError ? error.message : "Your agent couldn't check that. Try again.";
  }
  revalidatePath(`/my-stuff/${itemId}`);
  return null;
}
