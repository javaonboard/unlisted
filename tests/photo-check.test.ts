import { test } from "node:test";
import assert from "node:assert/strict";
import { seenText } from "@/components/shared/Thumb";

const base = { matches: true, mismatch: null, grade: "good" as const, wear: [], condition: "", needsWorking: false, workingShown: false, ask: null, at: "", photos: 1 };

test("photo check says what the agent saw", () => {
  assert.equal(seenText(null), null);
  assert.equal(seenText(base), "Photo check: good, no visible wear");
  assert.equal(seenText({ ...base, wear: ["stain on left cushion"] }), "Photo check: good, stain on left cushion");
});

test("photo check flags things not shown working, and wrong photos", () => {
  assert.match(seenText({ ...base, needsWorking: true })!, /not shown working yet/);
  assert.match(seenText({ ...base, needsWorking: true, workingShown: true })!, /shown working$/);
  assert.match(seenText({ ...base, matches: false, mismatch: "a wooden ladder" })!, /doesn't match: a wooden ladder/);
});
