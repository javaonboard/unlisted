import { randomUUID } from "node:crypto";
import { PaymentsController } from "@paypal/paypal-server-sdk";
import { paypalClient } from "./client";

const payments = () => new PaymentsController(paypalClient());

const usd = (value: string) => ({ currencyCode: "USD", value });

// Takes the money at handoff. Leave amount empty to capture the full hold.
export async function captureAuthorization(
  authorizationId: string,
  amount?: string,
) {
  const { result } = await payments().captureAuthorizedPayment({
    authorizationId,
    paypalRequestId: randomUUID(),
    body: { amount: amount ? usd(amount) : undefined, finalCapture: true },
  });
  console.log("[paypal] captured", authorizationId, result.id, result.status);
  return { captureId: result.id, status: result.status };
}

// Releases the hold when a deal falls apart.
export async function voidAuthorization(authorizationId: string) {
  await payments().voidPayment({
    authorizationId,
    paypalRequestId: randomUUID(),
  });
  console.log("[paypal] voided", authorizationId);
}

export async function refundCapture(captureId: string, amount: string) {
  const { result } = await payments().refundCapturedPayment({
    captureId,
    paypalRequestId: randomUUID(),
    body: { amount: usd(amount) },
  });
  console.log("[paypal] refunded", captureId, result.id, result.status);
  return { refundId: result.id, status: result.status };
}
