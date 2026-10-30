import { eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logActivity } from "@/lib/db/activity";

type PayPalEvent = { id: string; event_type: string; summary?: string; resource?: { id?: string; payout_batch_id?: string } };

// Stores a verified PayPal event once, attached to the deal it belongs to.
export async function recordPayPalEvent(event: PayPalEvent) {
  const ids = [event.resource?.id, event.resource?.payout_batch_id].filter(Boolean) as string[];
  const [leg] = ids.length
    ? await db
        .select()
        .from(schema.dealLegs)
        .where(
          or(
            ...ids.flatMap((id) => [
              eq(schema.dealLegs.orderId, id),
              eq(schema.dealLegs.authorizationId, id),
              eq(schema.dealLegs.captureId, id),
              eq(schema.dealLegs.payoutBatchId, id),
            ]),
          ),
        )
    : [];

  await logActivity({
    type: "paypal",
    message: `✓ PayPal confirmed: ${event.summary ?? event.event_type}`,
    paypalEventId: event.id,
    data: { eventType: event.event_type, resourceId: ids[0], ...(leg ? { dealId: leg.dealId, legId: leg.id } : {}) },
  });
}
