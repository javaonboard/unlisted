import { paypalAccessToken } from "./client";

const API = "https://api-m.sandbox.paypal.com";

// Asks PayPal whether a webhook really came from PayPal.
// The raw body is sent unchanged, since re-serializing it breaks the signature.
export async function verifyWebhook(headers: Headers, rawBody: string) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("Set PAYPAL_WEBHOOK_ID");

  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  };
  const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody}}`;

  const response = await fetch(`${API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await paypalAccessToken()}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const result = await response.json();
  return result.verification_status === "SUCCESS";
}
