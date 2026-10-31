import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceText, publicSpot } from "@/lib/places";

test("distance is rough, in plain words", () => {
  assert.equal(distanceText("Mueller", "Mueller"), "same neighborhood");
  assert.equal(distanceText("Mueller", "Cherrywood"), "under a mile");
  assert.equal(distanceText("Mueller", "Holly"), "about 3 mi");
});

test("the public spot is the easiest one for both people", () => {
  assert.equal(publicSpot("Mueller", "Mueller").area, "Mueller");
  assert.equal(publicSpot("East Austin", "Holly").area, "East Austin");
});
