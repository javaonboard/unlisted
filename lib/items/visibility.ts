import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";
import { rankBuyers } from "@/lib/scout/rank";
import { openRoom } from "@/lib/negotiation/room";
import { notify } from "@/lib/notifications/notify";
import { inSentence } from "@/lib/text/words";

const AT_ONCE = 3; // talk to the best few, not everyone

// Making something public: the Scout ranks who wants it, and the agent starts talking to the best few
// right away. Both sides hear about it. Everyone else finds it later through their own suggestions.
export async function goPublic(ownerId: string, itemId: string) {
  const [item] = await db.select().from(schema.items).where(and(eq(schema.items.id, itemId), eq(schema.items.ownerId, ownerId)));
  if (!item || item.openToOffers) return []; // already public: nothing to start again
  await db.update(schema.items).set({ openToOffers: true }).where(eq(schema.items.id, itemId));
  await logActivity({ userId: ownerId, type: "item", message: `Made ${item.title} public`, data: { itemId } });

  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, ownerId));
  const talking = await db.select({ intentId: schema.negotiations.intentId }).from(schema.negotiations).where(and(eq(schema.negotiations.itemId, itemId), inArray(schema.negotiations.status, ["open", "waiting_owner", "agreed"])));
  const picks = (await rankBuyers(itemId, owner.area)).filter((p) => !talking.some((t) => t.intentId === p.intentId)).slice(0, AT_ONCE);
  const what = inSentence(item.title);
  const first = (name: string) => name.split(" ")[0];

  const rooms: (typeof schema.negotiations.$inferSelect)[] = [];
  for (const pick of picks) {
    const room = await openRoom({ label: item.title, buyerId: pick.userId, sellerId: ownerId, itemId, intentId: pick.intentId! });
    const [need] = await db.select({ text: schema.intents.text }).from(schema.intents).where(eq(schema.intents.id, pick.intentId!));
    await notify(pick.userId, `${first(owner.name)}'s agent reached out`, `They have a ${what} for your “${need?.text}” (${pick.reasons.join(", ")}). Your agent is talking to theirs, and you'll be asked before anything is final.`, room.id);
    rooms.push(room);
  }
  if (rooms.length) {
    await notify(ownerId, `Your ${what} is public`, `I'm talking to ${picks.map((p) => first(p.name)).join(", ")}, the best matches nearby. Others will see it in their suggestions.`, rooms[0].id);
  } else {
    await notify(ownerId, `Your ${what} is public`, "Nobody nearby wants one right now. I'll tell you when someone does.");
  }
  return rooms; // the caller lets them play
}

// Back to private: new people can't start talks. Talks already going carry on.
export async function goPrivate(ownerId: string, itemId: string) {
  const [item] = await db.update(schema.items).set({ openToOffers: false }).where(and(eq(schema.items.id, itemId), eq(schema.items.ownerId, ownerId))).returning();
  if (item) await logActivity({ userId: ownerId, type: "item", message: `Made ${item.title} private`, data: { itemId } });
}
