import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RICH_TEXT_LIMIT, batchBlocks, chunkText, textToBlocks } from "../src/blocks.ts";

describe("blocks", () => {
  it("chunks strings at the Notion rich-text limit", () => {
    const long = "a".repeat(RICH_TEXT_LIMIT + 10);
    const chunks = chunkText(long);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, RICH_TEXT_LIMIT);
    assert.equal(chunks[1], "a".repeat(10));
  });

  it("turns each line into a paragraph block", () => {
    const blocks = textToBlocks("line one\nline two\n");
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0]?.paragraph.rich_text[0]?.text.content, "line one");
    assert.equal(blocks[1]?.paragraph.rich_text[0]?.text.content, "line two");
    assert.deepEqual(blocks[2]?.paragraph.rich_text, []);
  });

  it("splits a single overlong line across blocks", () => {
    const blocks = textToBlocks("x".repeat(4000));
    assert.equal(blocks.length, 2);
  });

  it("batches children into groups of 100", () => {
    const blocks = textToBlocks(Array.from({ length: 250 }, (_, i) => `l${i}`).join("\n"));
    const batches = batchBlocks(blocks);
    assert.equal(batches.length, 3);
    assert.equal(batches[0]?.length, 100);
    assert.equal(batches[1]?.length, 100);
    assert.equal(batches[2]?.length, 50);
  });
});
