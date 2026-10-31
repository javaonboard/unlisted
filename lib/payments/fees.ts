// Unlisted keeps a share of what the seller or provider receives.
// 8% covers PayPal's checkout and payout fees plus the AI, with a little left over.
export const FEE = 0.08;

export const feeOf = (price: number) => Math.round(price * FEE * 100) / 100;
export const payoutOf = (price: number) => Math.round((price - feeOf(price)) * 100) / 100;

// "$75" for whole dollars, "$69.50" otherwise.
export const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
