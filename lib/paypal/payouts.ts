import { randomUUID } from "node:crypto";
import { paypalAccessToken } from "./client";

const API = "https://api-m.sandbox.paypal.com";

// Sends money from the platform to a seller or mover after a handoff.
export async function sendPayout(receiverEmail: string, amount: string, note: string) {
  const response = await fetch(`${API}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await paypalAccessToken()}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": randomUUID(),
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: randomUUID(),
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
