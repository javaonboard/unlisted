import { randomUUID } from "node:crypto";
import { PaymentsController } from "@paypal/paypal-server-sdk";
import { paypalClient } from "./client";

const payments = () => new PaymentsController(paypalClient());

const usd = (value: string) => ({ currencyCode: "USD", value });

// Takes the money at handoff. Leave amount empty to capture the full hold.
// One hold can cover several legs: capture each one, and mark the last as final.
export async function captureAuthorization(
  authorizationId: string,
  amount?: string,
  final = true,
  requestId: string = randomUUID(), // pass a stable one (per leg) so a retry cannot capture twice
) {
  const { result } = await payments().captureAuthorizedPayment({
    authorizationId,
    paypalRequestId: requestId,
    body: { amount: amount ? usd(amount) : undefined, finalCapture: final },
  });
  console.log("[paypal] captured", authorizationId, result.id, result.status);
  return { captureId: result.id, status: result.status };
}

// Releases the hold when a deal falls apart.
export async function voidAuthorization(authorizationId: string) {
  await payments().voidPayment({
    authorizationId,
    paypalRequestId: `void-${authorizationId}`,
  });
  console.log("[paypal] voided", authorizationId);
}

export async function refundCapture(captureId: string, amount: string) {
  const { result } = await payments().refundCapturedPayment({
    captureId,
    paypalRequestId: `refund-${captureId}`, // one refund per capture, so a retry can't refund twice
    body: { amount: usd(amount) },
  });
  console.log("[paypal] refunded", captureId, result.id, result.status);
  return { refundId: result.id, status: result.status };
}
