import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceText, placesInReach, publicSpot } from "@/lib/places";

test("distance is rough, in plain words", () => {
  assert.equal(distanceText("Mueller", "Mueller"), "same neighborhood");
  assert.equal(distanceText("Mueller", "Cherrywood"), "under a mile");
  assert.equal(distanceText("Mueller", "Holly"), "about 3 mi");
});

test("the public spot is the easiest one for both people", () => {
  assert.equal(publicSpot("Mueller", "Mueller").area, "Mueller");
  assert.equal(publicSpot("East Austin", "Holly").area, "East Austin");
});

test("people only meet where nobody drives past their range", () => {
  const far = { buyerArea: "Mueller", sellerArea: "Holly" }; // about 3 mi apart
  assert.deepEqual(placesInReach({ ...far, buyerMiles: 10, sellerMiles: 0 }), ["seller_home"]); // pickup only
  assert.ok(placesInReach({ ...far, buyerMiles: 1, sellerMiles: 5 }).includes("buyer_home")); // seller delivers
  assert.deepEqual(placesInReach({ ...far, buyerMiles: 2, sellerMiles: 0 }), []); // no match at all
});
