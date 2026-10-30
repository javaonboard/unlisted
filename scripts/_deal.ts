import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
async function main() {
  const [deal] = await db.select().from(schema.deals).orderBy(desc(schema.deals.createdAt)).limit(1);
  const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, deal.id));
  for (const r of rooms) console.log(`${r.label} | ${r.status}${r.agreedPrice ? ` $${r.agreedPrice}` : ""}${r.closedReason ? ` (${r.closedReason})` : ""}${r.dependsOn.length ? ` | depends on ${r.dependsOn.length}` : ""}`);
  process.exit(0);
}
main();
