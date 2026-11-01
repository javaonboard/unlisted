// Payment states, grouped the way the app talks about them.
export const AFTER_HANDOFF = ["captured", "payout_sent", "paid_out", "payout_failed", "refunded"];
export const PAID = ["held", "in_use", ...AFTER_HANDOFF];

// How each state reads for a person.
export const STATUS_TEXT: Record<string, string> = {
  pending: "Not paid yet",
  held: "Paid, PayPal is holding it",
  in_use: "Rented out, deposit held",
  captured: "Charged",
  capture_failed: "PayPal declined the payment",
  voided: "Released, nothing charged",
  payout_sent: "Payout sent, waiting for PayPal",
  paid_out: "Paid out, confirmed by PayPal",
  payout_failed: "Payout didn't go through",
  refunded: "Refunded",
};
