import { test } from "node:test";
import assert from "node:assert/strict";
import { FEE, feeOf, money, payoutOf } from "@/lib/payments/fees";

test("the seller gets the price minus Unlisted's fee, to the cent", () => {
  assert.equal(FEE, 0.08);
  assert.equal(feeOf(75), 6);
  assert.equal(payoutOf(75), 69);
  assert.equal(payoutOf(218), 200.56);
  assert.equal(feeOf(218) + payoutOf(218), 218);
});

test("money reads like a person wrote it", () => {
  assert.equal(money(75), "$75");
  assert.equal(money(200.56), "$200.56");
  assert.equal(money(69.5), "$69.50");
});

test("a rental captures the fee and gives the deposit back, unless something's wrong", async () => {
  const { rentalCapture } = await import("@/lib/payments/fees");
  assert.equal(rentalCapture(30, 60, true), 30);
  assert.equal(rentalCapture(30, 60, false), 90);
  assert.equal(payoutOf(rentalCapture(30, 60, true)), 27.6); // owner gets the fee minus 8%
});
