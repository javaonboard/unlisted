import { test } from "node:test";
import assert from "node:assert/strict";
import { clashes, type Use } from "@/lib/deals/clash";

// Kai's ladder: rented Saturday, maybe rented again, maybe sold.
const day = (d: number) => new Date(2026, 10, d, 9);
const rental = (from: number, days = 1, back = false): Use => ({ sale: false, from: day(from), to: day(from + days), back });
const sale: Use = { sale: true, from: day(10), to: day(11), back: false };

test("a sale takes the item for good", () => {
  assert.equal(clashes(rental(20), sale), true);
  assert.equal(clashes(sale, sale), true);
});

test("rentals only clash on the same days, and not once it's back", () => {
  assert.equal(clashes(rental(7), rental(7)), true);
  assert.equal(clashes(rental(8), rental(7, 2)), true);
  assert.equal(clashes(rental(9), rental(7, 2)), false);
  assert.equal(clashes(rental(7), rental(7, 1, true)), false);
});

test("a sale hands off only after every rental is back; unknown days play safe", () => {
  assert.equal(clashes(sale, rental(7)), false);
  assert.equal(clashes(sale, rental(12)), true);
  assert.equal(clashes(sale, rental(9, 2)), true);
  assert.equal(clashes({ sale: false, from: null, to: null, back: false }, rental(7)), true);
});
