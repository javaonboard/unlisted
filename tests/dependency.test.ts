import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedBy } from "@/lib/deals/dependency";

const deal = { ownerId: "maya", isPlan: true, saleWaitsForPurchase: true, helperIds: ["mover-need"] };
const room = (r: Partial<{ id: string; status: string; buyerId: string; sellerId: string; intentId: string }>) =>
  ({ id: "x", status: "open", buyerId: "maya", sellerId: "sam", intentId: "sofa-need", label: null, dependsOn: [], ...r });

test("Maya's sale waits until her sofa purchase is agreed", () => {
  const sale = room({ id: "sale", status: "agreed", buyerId: "ben", sellerId: "maya", intentId: "ben-need" });
  const buying = [room({ id: "sam" }), room({ id: "sara", status: "closed" })];
  assert.equal(blockedBy(sale, deal, [sale, ...buying]), "the purchase to be agreed first");
  buying[0].status = "agreed";
  assert.equal(blockedBy(sale, deal, [sale, ...buying]), null);
});

test("no wait when the owner chose to sell on its own, for purchases, or outside plans", () => {
  const sale = room({ status: "agreed", buyerId: "ben", sellerId: "maya" });
  assert.equal(blockedBy(sale, { ...deal, saleWaitsForPurchase: false }, [sale, room({})]), null);
  assert.equal(blockedBy(room({ status: "agreed" }), deal, [room({})]), null); // Maya buying never waits
  assert.equal(blockedBy(sale, null, []), null);
});

test("the mover's job doesn't count as a purchase to wait for", () => {
  const sale = room({ id: "sale", status: "agreed", buyerId: "ben", sellerId: "maya", intentId: "ben-need" });
  const sofa = room({ id: "sam", status: "agreed" });
  const mover = room({ id: "marco", intentId: "mover-need", sellerId: "marco" });
  assert.equal(blockedBy(sale, deal, [sale, sofa, mover]), null);
});
