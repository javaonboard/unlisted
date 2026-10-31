import { test } from "node:test";
import assert from "node:assert/strict";
import { missing, type Card } from "@/lib/vault/card";

const card = (c: Partial<Card>): Card =>
  ({ kind: "need", title: "Lawn mowing", category: "lawn", details: null, condition: null, value: null, minPrice: null, freeHours: [], specs: [], requirements: [], maxMiles: null, ways: ["sell"], rentPerDay: null, deposit: null, days: null, needType: "request_service", maxPrice: null, dueInDays: null, ...c }) as Card;

test("a need can't be saved without a budget and a time", () => {
  assert.deepEqual(missing(card({})), ["budget", "when"]);
  assert.deepEqual(missing(card({ maxPrice: 40 })), ["when"]);
  assert.deepEqual(missing(card({ maxPrice: 40, dueInDays: 2 })), []);
});

test("something to sell needs a condition and a lowest price ($0 is fine)", () => {
  const goods = card({ kind: "goods", needType: null });
  assert.deepEqual(missing(goods), ["condition", "lowest price"]);
  assert.deepEqual(missing({ ...goods, condition: "Good", minPrice: 0 }), []);
});

test("a service on offer needs a price and some free hours", () => {
  const skill = card({ kind: "skill", needType: null });
  assert.deepEqual(missing(skill), ["price per job", "when you're free"]);
  assert.deepEqual(missing({ ...skill, value: 60, freeHours: [{ start: "2026-11-01T15:00:00Z", end: "2026-11-01T20:00:00Z" }] }), []);
});

test("renting needs a daily price on one side and the number of days on the other", () => {
  const ladder = card({ kind: "goods", needType: null, condition: "Good", ways: ["rent"] });
  assert.deepEqual(missing(ladder), ["price per day"]);
  assert.deepEqual(missing({ ...ladder, rentPerDay: 15 }), []); // rent only: no lowest sale price needed
  const borrow = card({ needType: "rent", maxPrice: 30, dueInDays: 2 });
  assert.deepEqual(missing(borrow), ["for how many days"]);
  assert.deepEqual(missing({ ...borrow, days: 1 }), []);
});
