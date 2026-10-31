import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMove } from "@/lib/negotiation/guardrails";
import type { Move } from "@/lib/negotiation/moves";

const sat9 = "2026-10-31T14:00:00.000Z";
const move = (m: Partial<Move>): Move =>
  ({ action: "offer", price: 200, when: null, slotStart: sat9, place: null, meetAt: null, costs: null, extras: [], evidenceIds: [], message: "hi", askOwner: null, reasoning: "", signalsUsed: [], ...m }) as Move;
const rules = (r: Partial<Parameters<typeof checkMove>[1]> = {}) => ({
  limits: { role: "buyer" as const, limit: 250, target: 210 },
  evidenceIds: ["ev1"],
  standingPrice: null,
  alreadyAsked: false,
  busy: [],
  ...r,
});

test("a buyer's agent can't offer above the owner's limit", () => {
  assert.match(checkMove(move({ price: 260 }), rules())!, /above your owner's limit/);
  assert.equal(checkMove(move({ price: 250 }), rules()), null);
});

test("a seller's agent can't go below the owner's minimum", () => {
  const seller = rules({ limits: { role: "seller", limit: 150, target: 240 } });
  assert.match(checkMove(move({ price: 140 }), seller)!, /below your owner's minimum/);
  assert.equal(checkMove(move({ price: 150 }), seller), null);
});

test("accepting uses the other side's standing price, which must be within limits", () => {
  assert.match(checkMove(move({ action: "accept", price: null }), rules())!, /no offer to accept/);
  assert.match(checkMove(move({ action: "accept", price: null }), rules({ standingPrice: 300 }))!, /above/);
  assert.equal(checkMove(move({ action: "accept", price: null }), rules({ standingPrice: 240 })), null);
});

test("every offer names an exact time", () => {
  assert.match(checkMove(move({ slotStart: null }), rules())!, /slotStart/);
  assert.match(checkMove(move({ slotStart: "next saturday" }), rules())!, /ISO/);
});

test("a time that clashes with a booking is refused", () => {
  const busy = [{ startsAt: new Date("2026-10-31T13:30:00Z"), endsAt: new Date("2026-10-31T14:15:00Z") }];
  assert.match(checkMove(move({}), rules({ busy }))!, /clashes/);
  assert.equal(checkMove(move({ slotStart: "2026-10-31T15:00:00.000Z" }), rules({ busy })), null);
});

test("if someone marked free hours, the time must fall inside them", () => {
  const free = [[{ startsAt: new Date("2026-10-31T18:00:00Z"), endsAt: new Date("2026-10-31T21:00:00Z") }]];
  assert.match(checkMove(move({}), rules({ free }))!, /outside the free hours/);
  assert.equal(checkMove(move({ slotStart: "2026-10-31T19:00:00.000Z" }), rules({ free })), null);
  assert.equal(checkMove(move({}), rules({ free: [[]] })), null); // no hours marked: anything free goes
});

test("agents can only cite evidence that exists", () => {
  assert.match(checkMove(move({ evidenceIds: ["made-up"] }), rules())!, /Unknown evidence/);
  assert.equal(checkMove(move({ evidenceIds: ["ev1"] }), rules()), null);
});

test("an agent asks its owner at most once per room", () => {
  const ask = move({ action: "ask_owner", askOwner: { question: "Go to $260?", suggestedPrice: 260 } });
  assert.equal(checkMove(ask, rules()), null);
  assert.match(checkMove(ask, rules({ alreadyAsked: true }))!, /already asked/);
});

test("the agreed place has to keep both people within range", () => {
  assert.match(checkMove(move({ meetAt: "buyer_home" }), rules({ places: ["seller_home"] }))!, /drive further/);
  assert.equal(checkMove(move({ meetAt: "seller_home" }), rules({ places: ["seller_home"] })), null);
});
