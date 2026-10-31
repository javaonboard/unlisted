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
