import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { money, payoutOf } from "@/lib/payments/fees";
import { inSentence } from "@/lib/text/words";

// When a deal is agreed with a time, put it on both people's calendars as tentative.
// It is final once both confirm: the payer by placing the PayPal hold, the other side with "Confirm time".
export async function bookAgreedDeal(roomId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (room?.status !== "agreed") return;
  const existing = await db.select().from(schema.bookings).where(eq(schema.bookings.roomId, roomId));

  // The accept usually doesn't repeat the time: use the latest message that named one.
  const moves = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, roomId)).orderBy(desc(schema.offers.round));
  const slot = moves.map((m) => (m.terms as { slotStart?: string }).slotStart).find(Boolean);
  const start = new Date(slot ?? "");
  if (Number.isNaN(start.getTime())) return;

  const [item] = await db.select().from(schema.items).where(eq(schema.items.id, room.itemId!));
  const users = await db.select().from(schema.users);
  const first = (id: string) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? id;
  const service = item.kind === "skill";
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, room.intentId!));
  const days = need?.type === "rent" ? (need.days ?? 1) : 0; // a rental runs from pickup to return
  const end = new Date(start.getTime() + (days ? days * 86_400_000 : service ? 2 * 3_600_000 : 30 * 60_000));
  const back = end.toLocaleString("en-US", { weekday: "short" });
  const what = inSentence(item.title);
  const when = start.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

  // The time was changed: move both rows, tell both people, and ask whoever hasn't said yes yet.
  if (existing.length) {
    await db.update(schema.bookings).set({ startsAt: start, endsAt: end }).where(eq(schema.bookings.roomId, roomId));
    for (const row of existing) {
      await notify(row.userId, row.confirmedAt ? "New time" : "New time to confirm", `${row.title}, ${when}.`, roomId);
    }
    console.log("[booking] moved", start.toISOString());
    // In a plan, a new time can affect the other parts: the plan agent adjusts them, and they play on.
    const { onPlanChanged } = await import("@/lib/plans/cascade");
    const { playRoom } = await import("@/lib/negotiation/room");
    for (const r of await onPlanChanged(roomId)) await playRoom(r.id);
    return;
  }

  // What each side sees on their calendar.
  const sellerTitle = days ? `Lend ${what} to ${first(room.buyerId)} (back ${back})` : service ? `${item.title} for ${first(room.buyerId)}` : `Hand off ${what} to ${first(room.buyerId)}`;
  const buyerTitle = days ? `Borrow ${first(room.sellerId)}'s ${what} (return ${back})` : service ? `${first(room.sellerId)}: ${what}` : `Pick up ${what} from ${first(room.sellerId)}`;
  await db.insert(schema.bookings).values([
    { userId: room.sellerId, roomId, dealId: room.dealId, startsAt: start, endsAt: end, title: sellerTitle },
    { userId: room.buyerId, roomId, dealId: room.dealId, startsAt: start, endsAt: end, title: buyerTitle },
  ]);
  const price = money(Number(room.agreedPrice));
  const payout = `${money(payoutOf(Number(room.agreedPrice)))} after fees`;
  const deposit = days && item.deposit ? ` plus a ${money(Number(item.deposit))} deposit you get back` : "";
  await notify(room.sellerId, days ? `Renting to ${first(room.buyerId)} · you get ${payout}` : service ? `New job for ${first(room.buyerId)} · you get ${payout}` : `Sold to ${first(room.buyerId)} · you get ${payout}`, `${sellerTitle}, ${when}. Please confirm the time.`, roomId);
  await notify(room.buyerId, days ? `Renting ${first(room.sellerId)}'s ${what} · you pay ${price}${deposit}` : service ? `${first(room.sellerId)} will do your ${what} · you pay ${price}` : `Bought ${first(room.sellerId)}'s ${what} · you pay ${price}`, `${buyerTitle}, ${when}. Holding the payment confirms it.`, roomId);
  console.log("[booking] booked both sides (tentative)", start.toISOString());
}

// One person says yes to the time.
export async function confirmTime(roomId: string, userId: string) {
  await db
    .update(schema.bookings)
    .set({ confirmedAt: new Date() })
    .where(and(eq(schema.bookings.roomId, roomId), eq(schema.bookings.userId, userId), isNull(schema.bookings.confirmedAt)));
}

// Who still has to say yes, per room. Empty means the time is final.
export async function waitingOn(roomIds: string[]) {
  const rows = roomIds.length ? await db.select().from(schema.bookings).where(inArray(schema.bookings.roomId, roomIds)) : [];
  const waiting: Record<string, string[]> = {};
  for (const id of roomIds) waiting[id] = rows.filter((b) => b.roomId === id && !b.confirmedAt).map((b) => b.userId);
  return waiting;
}

// Someone's busy times, without what they are (free/busy only). Tentative times count too.
// A room changing its own time leaves its old slot out.
export async function busyTimes(userId: string, exceptRoomId?: string) {
  const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.userId, userId));
  return rows.filter((r) => !exceptRoomId || r.roomId !== exceptRoomId).map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
}

export async function myBookings(userId: string, roomId?: string) {
  return db
    .select()
    .from(schema.bookings)
    .where(roomId ? and(eq(schema.bookings.userId, userId), eq(schema.bookings.roomId, roomId)) : eq(schema.bookings.userId, userId));
}
