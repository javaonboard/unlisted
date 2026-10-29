// Runs one negotiation between Maya's sectional and a buyer's request.
//   npm run room:check -- [buyerId]
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { findDemandFor } from "@/lib/matching/matcher";
import { openRoom, playRoom } from "@/lib/negotiation/room";

async function main() {
  const buyerId = process.argv[2] ?? "ben";
  const [sectional] = await db
    .select()
    .from(schema.vaultItems)
    .where(and(eq(schema.vaultItems.ownerId, "maya"), eq(schema.vaultItems.category, "sofa")));

  const demand = await findDemandFor(sectional.id);
  console.log("demand:", demand.map((i) => `${i.ownerId} (max $${i.maxPrice})`).join(", "));

  const intent = demand.find((i) => i.ownerId === buyerId);
  if (!intent) throw new Error(`${buyerId} has no matching request`);

  const room = await openRoom({ buyerId, sellerId: "maya", itemId: sectional.id, intentId: intent.id });
  const result = await playRoom(room.id);

  const moves = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, room.id));
  for (const m of moves.sort((a, b) => a.round - b.round)) {
    console.log(`\n#${m.round} ${m.fromUserId} ${m.kind}${m.price ? ` $${m.price}` : ""} ${m.terms && (m.terms as { pickup?: string }).pickup ? `(${(m.terms as { pickup?: string }).pickup})` : ""}`);
    console.log(`  says: ${m.note}`);
    console.log(`  why (private): ${m.reasoning}`);
    if (m.signalsUsed.length) console.log(`  signals: ${m.signalsUsed.join(" | ")}`);
  }
  console.log(`\nresult: ${result.status}${result.agreedPrice ? ` at $${result.agreedPrice}` : ""}${result.closedReason ? ` (${result.closedReason})` : ""}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
