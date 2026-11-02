export type Ways = "sell" | "rent" | "both";

// How an item can go: sold, rented out, or both.
export const waysOf = (item: { forSale: boolean; rentPerDay: string | null }): Ways => (item.rentPerDay ? (item.forSale ? "both" : "rent") : "sell");
