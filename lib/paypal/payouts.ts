import { randomUUID } from "node:crypto";
import { paypalAccessToken } from "./client";

const API = "https://api-m.sandbox.paypal.com";

// Sends money from the platform to a seller or mover after a handoff.
// `key` (e.g. the leg id) makes a retry safe: PayPal rejects a second batch with the same id.
export async function sendPayout(receiverEmail: string, amount: string, note: string, key: string = randomUUID()) {
  const response = await fetch(`${API}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await paypalAccessToken()}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `payout-${key}`,
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `payout-${key}`,
        email_subject: "You have a payment from Unlisted",
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: receiverEmail,
          amount: { value: amount, currency: "USD" },
          note,
        },
      ],
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));

  const batch = result.batch_header;
  console.log("[paypal] payout sent", batch.payout_batch_id, batch.batch_status);
  return { batchId: batch.payout_batch_id as string, status: batch.batch_status as string };
}

// The status of a payout's (only) item, straight from PayPal: SUCCESS, PENDING, UNCLAIMED, FAILED...
export async function getPayoutItemStatus(batchId: string) {
  const response = await fetch(`${API}/v1/payments/payouts/${batchId}`, { headers: { Authorization: `Bearer ${await paypalAccessToken()}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return (result.items?.[0]?.transaction_status ?? result.batch_header?.batch_status) as string;
}
