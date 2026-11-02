import { test } from "node:test";
import assert from "node:assert/strict";
import { inPlanOrder, planSteps } from "@/lib/deals/order";

// Maya's moving day: she buys a sofa, sells her sectional, and hires a mover.
const deal = { ownerId: "maya", helperIds: ["need-mover"] };
const mover = { id: "mover", status: "agreed", sellerId: "marco", intentId: "need-mover" };
const sell = { id: "sell", status: "agreed", sellerId: "maya", intentId: "need-omar" };
const buy = { id: "buy", status: "agreed", sellerId: "sam", intentId: "need-sofa" };
const lost = { id: "lost", status: "closed", sellerId: "sara", intentId: "need-sofa" };

test("a plan is approved buy first, then sell, then helpers; ended talks don't count", () => {
  const steps = planSteps([mover, sell, lost, buy], deal);
  assert.deepEqual([...steps.entries()], [["buy", { step: 1, total: 3 }], ["sell", { step: 2, total: 3 }], ["mover", { step: 3, total: 3 }]]);
});

test("the inbox keeps a plan's parts together in plan order, other deals by time", () => {
  const steps = planSteps([mover, sell, buy], deal);
  const at = (m: number) => new Date(2026, 10, 1, 12, m);
  const threads = [
    { roomId: "mover", planId: "plan", at: at(30) },
    { roomId: "gutters", planId: null, at: at(20) },
    { roomId: "buy", planId: "plan", at: at(10) },
    { roomId: "sell", planId: "plan", at: at(5) },
    { roomId: "lawn", planId: null, at: at(40) },
  ];
  assert.deepEqual(inPlanOrder(threads, steps).map((t) => t.roomId), ["lawn", "buy", "sell", "mover", "gutters"]);
});
