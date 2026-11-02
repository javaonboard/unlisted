import { test } from "node:test";
import assert from "node:assert/strict";
import { verificationBody, verifyWebhook } from "@/lib/paypal/webhooks";

const headers = new Headers({
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
  "paypal-transmission-id": "t-1",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-10-31T12:00:00Z",
});

test("the webhook body goes to PayPal byte for byte", () => {
  // Spacing and key order matter for the signature, so it must not be re-serialized.
  const raw = '{"id":"WH-1",  "event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"amount":{"value":"75.00"}}}';
  const body = verificationBody(headers, raw, "WH-ID");
  assert.ok(body.endsWith(`"webhook_event":${raw}}`));
  const parsed = JSON.parse(body);
  assert.equal(parsed.webhook_id, "WH-ID");
  assert.equal(parsed.transmission_sig, "sig");
  assert.equal(parsed.webhook_event.id, "WH-1");
});

test("without a webhook id nothing is trusted", async () => {
  const saved = process.env.PAYPAL_WEBHOOK_ID;
  delete process.env.PAYPAL_WEBHOOK_ID;
  await assert.rejects(verifyWebhook(headers, "{}"), /PAYPAL_WEBHOOK_ID/);
  if (saved) process.env.PAYPAL_WEBHOOK_ID = saved;
});

test("every payout event PayPal sends maps to a payout step", async () => {
  const { PAYPAL_EVENTS } = await import("@/lib/payments/events");
  for (const type of ["SUCCEEDED", "FAILED", "UNCLAIMED", "RETURNED", "BLOCKED", "CANCELED", "REFUNDED"]) {
    assert.equal(PAYPAL_EVENTS[`PAYMENT.PAYOUTS-ITEM.${type}`]?.stage, "payout", type);
  }
  assert.equal(PAYPAL_EVENTS["PAYMENT.PAYOUTS-ITEM.SUCCEEDED"].ok, true);
});
