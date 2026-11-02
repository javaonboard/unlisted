import { eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AFTER_HANDOFF } from "@/lib/payments/states";

// What someone sold, bought, hired or rented, once it's handed over. Newest first.
export async function pastFor(userId: string) {
  const legs = (await db.select().from(schema.dealLegs).where(or(eq(schema.dealLegs.payerId, userId), eq(schema.dealLegs.payeeId, userId)))).filter((l) =>
    AFTER_HANDOFF.includes(l.status),
  );
  const people = Object.fromEntries((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users)).map((u) => [u.id, u.name.split(" ")[0]]));
  return legs
    .map((l) => {
      const mine = l.payeeId === userId;
      const verb = l.kind === "rental" ? (mine ? "Rented out to" : "Rented from") : l.kind === "service" ? (mine ? "Job for" : "Hired") : mine ? "Sold to" : "Bought from";
      return { legId: l.id, what: l.description, line: `${verb} ${people[mine ? l.payerId : l.payeeId]}`, amount: Number(l.charged ?? l.amount), at: l.capturedAt ?? l.handoffAt ?? l.createdAt, refunded: l.problem?.status === "refunded" };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
