import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { findDemandFor, findSupplyFor } from "@/lib/matching/matcher";
import { milesBetween } from "@/lib/places";
import { nextSaturday } from "@/lib/dates";

export type Pick = { userId: string; name: string; intentId?: string; itemId?: string; score: number; reasons: string[] };

// How someone has done in past negotiations: public, from finished rooms.
async function trackRecord(userId: string) {
  const rooms = (await db.select().from(schema.negotiations)).filter((r) => r.buyerId === userId || r.sellerId === userId);
  const finished = rooms.filter((r) => r.status === "agreed" || r.status === "closed");
  const agreed = finished.filter((r) => r.status === "agreed").length;
  return finished.length ? agreed / finished.length : null;
}

async function people() {
  const users = await db.select().from(schema.users);
  return (id: string) => users.find((u) => u.id === id)!;
}

// Ranks with public facts only: distance, timing, free time and track record.
// Whether prices can meet comes from the matcher as a yes/no, never as numbers.
export async function rankBuyers(itemId: string, ownerArea: string): Promise<Pick[]> {
  const user = await people();
  const buyers = await findDemandFor(itemId);
  return Promise.all(
    buyers.map(async (intent) => {
      const u = user(intent.ownerId);
      const miles = milesBetween(ownerArea, u.area);
      const record = await trackRecord(u.id);
      const reasons = [`${miles} mi away`];
      let score = 10 - miles;
      if (intent.dueAt && intent.dueAt.getTime() - Date.now() < 7 * 86_400_000) { score += 2; reasons.push("needs it soon"); }
      if (record !== null) { score += record * 3; reasons.push(`closes ${Math.round(record * 100)}% of deals`); }
      return { userId: u.id, name: u.name, intentId: intent.id, score, reasons };
    }),
  ).then((list) => list.sort((a, b) => b.score - a.score));
}

export async function rankSellers(intentId: string, ownerArea: string): Promise<Pick[]> {
  const user = await people();
  const items = (await findSupplyFor(intentId)).filter((i) => i.openToOffers);
  const saturday = nextSaturday(9);
  return Promise.all(
    items.map(async (item) => {
      const u = user(item.ownerId);
      const miles = milesBetween(ownerArea, u.area);
      const reasons = [`${miles} mi away`];
      let score = 10 - miles;

      if (item.kind === "skill") {
        // Providers: free on Saturday morning matters most for a move.
        const busy = await db.select().from(schema.bookings).where(eq(schema.bookings.userId, item.ownerId));
        const freeMorning = !busy.some((b) => b.startsAt.getTime() <= saturday.getTime() + 3 * 3_600_000 && b.endsAt > saturday);
        score += freeMorning ? 4 : -2;
        reasons.push(freeMorning ? "free Saturday morning" : "busy until the afternoon");
      } else if (item.condition) {
        reasons.push(item.condition.toLowerCase());
      }

      const record = await trackRecord(u.id);
      if (record !== null) { score += record * 3; reasons.push(`closes ${Math.round(record * 100)}% of deals`); }
      return { userId: u.id, name: u.name, itemId: item.id, score, reasons };
    }),
  ).then((list) => list.sort((a, b) => b.score - a.score));
}
