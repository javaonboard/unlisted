import { test } from "node:test";
import assert from "node:assert/strict";
import { nextFor, roleOf } from "@/lib/anchors/next";

type View = Parameters<typeof nextFor>[0];

// A solo gutter job: Gus (seller) does it for Sara (buyer).
const view = (over: Record<string, unknown> = {}) =>
  ({
    room: { id: "r1", status: "agreed", buyerId: "sara", sellerId: "gus", agreedPrice: "75.00", label: "Gutter cleaning", closedReason: null },
    deal: { id: "d1", title: "Gutter cleaning", ownerId: "sara" },
    item: { kind: "skill", title: "Gutter cleaning" },
    names: { sara: "Sara Kim", gus: "Gus Patel" },
    messages: [],
    leg: { id: "l1", payerId: "sara", payeeId: "gus", status: "pending" },
    waitingOn: [],
    blockedBy: null,
    booking: { startsAt: new Date("2026-10-31T14:00:00Z"), endsAt: new Date("2026-10-31T16:00:00Z") },
    ...over,
  }) as unknown as View;

test("each side sees who they are in the deal", () => {
  assert.equal(roleOf(view(), "gus").badge, "You do the job");
  assert.match(roleOf(view(), "gus").title, /you get \$69 after fees/);
  assert.equal(roleOf(view(), "sara").badge, "You hired");
  assert.match(roleOf(view(), "sara").title, /you pay \$75/);
});

test("first step for both sides: accept the deal and its time", () => {
  const v = view({ hasLegs: false, leg: null, deal: null, waitingOn: ["gus", "sara"] });
  assert.deepEqual(nextFor(v, "gus"), { state: "needs_you", label: "Approve the deal" });
  assert.deepEqual(nextFor(v, "sara"), { state: "needs_you", label: "Approve the deal" });
});

test("after the seller accepts, the buyer still accepts before paying", () => {
  const v = view({ waitingOn: ["sara"] });
  assert.deepEqual(nextFor(v, "sara"), { state: "needs_you", label: "Approve the deal" });
  assert.deepEqual(nextFor(v, "gus"), { state: "waiting", label: "Waiting for Sara to approve" });
});

test("both accepted: the buyer pays with PayPal", () => {
  assert.deepEqual(nextFor(view(), "sara"), { state: "needs_you", label: "Pay with PayPal" });
  assert.deepEqual(nextFor(view(), "gus"), { state: "waiting", label: "Waiting for Sara to pay" });
});

test("held and accepted by both: the handoff is next, nothing needs anyone", () => {
  const v = view({ leg: { id: "l1", payerId: "sara", payeeId: "gus", status: "held" } });
  assert.equal(nextFor(v, "gus").state, "upcoming");
  assert.equal(nextFor(v, "sara").state, "upcoming");
});

test("a new time after paying is accepted again by whoever didn't ask for it", () => {
  const v = view({ waitingOn: ["sara"], leg: { id: "l1", payerId: "sara", payeeId: "gus", status: "held" } });
  assert.equal(nextFor(v, "sara").label, "Approve the deal");
  assert.equal(nextFor(v, "gus").label, "Waiting for Sara to approve");
});

test("paid out or cancelled deals are done", () => {
  assert.equal(nextFor(view({ leg: { status: "paid_out", payerId: "sara", payeeId: "gus" } }), "gus").state, "done");
  assert.equal(nextFor(view({ leg: { status: "voided", payerId: "sara", payeeId: "gus" } }), "sara").label, "Cancelled, nothing charged");
});

test("in a plan, a sale that waits for the purchase can't move yet, for either side", () => {
  const v = view({ blockedBy: "the purchase to be agreed first", waitingOn: ["gus", "sara"] });
  assert.deepEqual(nextFor(v, "gus"), { state: "waiting", label: "Waiting for the purchase to be agreed first" });
  assert.equal(nextFor(v, "sara").state, "waiting");
});

test("an agent's question is only for its own owner", () => {
  const v = view({ room: { id: "r1", status: "waiting_owner", buyerId: "sara", sellerId: "gus", agreedPrice: null }, messages: [{ kind: "ask_owner", fromUserId: "gus" }] });
  assert.equal(nextFor(v, "gus").label, "Answer your agent");
  assert.equal(nextFor(v, "sara").state, "talking");
});
