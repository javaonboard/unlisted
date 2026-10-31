import { test } from "node:test";
import assert from "node:assert/strict";
import { boldParts, toBlocks } from "@/lib/text/blocks";

test("points run together on one line get their own lines", () => {
  const blocks = toBlocks("Here's the plan: 1. Sell the sofa. 2. Buy the new one. 3. Book a mover.");
  assert.deepEqual(blocks, [
    { type: "p", lines: ["Here's the plan:"] },
    { type: "ol", lines: ["Sell the sofa.", "Buy the new one.", "Book a mover."] },
  ]);
});

test("bullets and paragraphs stay apart", () => {
  const blocks = toBlocks("What I know:\n- weekends work\n- second floor\nThanks!");
  assert.deepEqual(blocks.map((b) => b.type), ["p", "ul", "p"]);
});

test("prices like $2.50 are not mistaken for list numbers", () => {
  assert.deepEqual(toBlocks("It's $2.50 per mile."), [{ type: "p", lines: ["It's $2.50 per mile."] }]);
});

test("bold is picked out", () => {
  assert.deepEqual(boldParts("Pick up **Saturday 9am** please"), [
    { bold: false, text: "Pick up " },
    { bold: true, text: "Saturday 9am" },
    { bold: false, text: " please" },
  ]);
});

test("titles read naturally mid-sentence but keep names and acronyms", async () => {
  const { inSentence } = await import("@/lib/text/words");
  assert.equal(inSentence("Grey 3-seat sectional"), "grey 3-seat sectional");
  assert.equal(inSentence("RTX 4070 graphics card"), "RTX 4070 graphics card");
  assert.equal(inSentence("Wi-Fi, TV mounting and PC setup"), "Wi-Fi, TV mounting and PC setup");
});
