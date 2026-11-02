export type Stage = "hold" | "capture" | "payout" | "refund" | "release";

// Which signed PayPal event confirms (or fails) which money step.
export const PAYPAL_EVENTS: Record<string, { stage: Stage; ok: boolean }> = {
  "PAYMENT.AUTHORIZATION.CREATED": { stage: "hold", ok: true },
  "PAYMENT.AUTHORIZATION.VOIDED": { stage: "release", ok: true },
  "PAYMENT.CAPTURE.COMPLETED": { stage: "capture", ok: true },
  "PAYMENT.CAPTURE.DENIED": { stage: "capture", ok: false },
  "PAYMENT.CAPTURE.DECLINED": { stage: "capture", ok: false },
  "PAYMENT.CAPTURE.REFUNDED": { stage: "refund", ok: true },
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": { stage: "payout", ok: true },
  "PAYMENT.PAYOUTS-ITEM.FAILED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.RETURNED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.BLOCKED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.DENIED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.CANCELED": { stage: "payout", ok: false },
  "PAYMENT.PAYOUTS-ITEM.REFUNDED": { stage: "payout", ok: false },
};
// PAYMENT.PAYOUTS-ITEM.HELD (PayPal reviewing it) changes nothing: the payout stays "sent" until it succeeds or fails.
