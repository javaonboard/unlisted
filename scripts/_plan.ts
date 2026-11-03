import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
async function main() {
  const deals = (await db.select().from(schema.deals)).filter((d) => d.isPlan);
  if (!deals.length) { console.log("no plan"); process.exit(0); }
  const rooms = (await db.select().from(schema.negotiations)).filter((r) => r.dealId === deals[0].id);
  const bookings = rooms.length ? await db.select().from(schema.bookings).where(inArray(schema.bookings.roomId, rooms.map((r) => r.id))) : [];
  const offers = rooms.length ? await db.select().from(schema.offers).where(inArray(schema.offers.negotiationId, rooms.map((r) => r.id))) : [];
  for (const r of rooms) {
    const b = bookings.find((x) => x.roomId === r.id);
    const stretch = offers.filter((o) => o.negotiationId === r.id && o.overLimit).length;
    const cites = offers.filter((o) => o.negotiationId === r.id && o.evidenceIds.length).length;
    console.log(r.label, "|", r.status, r.agreedPrice ?? "", r.closedReason ?? "", r.reopenedBy ?? "", "|", b ? b.startsAt.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" }) : "", `| stretch ${stretch}, evidence ${cites}`);
  }
  process.exit(0);
}
main();
