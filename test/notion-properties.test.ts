import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPageProperties, mapSchema } from "../src/notion.ts";

describe("notion properties", () => {
  it("maps title plus optional Source Filename and Last Modified", () => {
    const schema = mapSchema(
      {
        Name: { type: "title" },
        "Source Filename": { type: "rich_text" },
        "Last Modified": { type: "date" },
        Tags: { type: "multi_select" },
      },
      "ds-1",
    );
    assert.equal(schema.titleProperty, "Name");
    assert.equal(schema.sourceFilenameProperty, "Source Filename");
    assert.equal(schema.lastModifiedProperty, "Last Modified");

    const properties = buildPageProperties(schema, {
      title: "standup",
      filename: "standup.vtt",
      mtimeMs: Date.parse("2026-10-08T12:00:00.000Z"),
      body: "hi",
    });
    assert.deepEqual(properties.Name, { title: [{ text: { content: "standup" } }] });
    assert.deepEqual(properties["Source Filename"], {
      rich_text: [{ text: { content: "standup.vtt" } }],
    });
    assert.deepEqual(properties["Last Modified"], {
      date: { start: "2026-10-08T12:00:00.000Z" },
    });
    assert.equal(properties.Tags, undefined);
  });

  it("matches property names case-insensitively and skips missing optional fields", () => {
    const schema = mapSchema({ Title: { type: "title" }, filename: { type: "rich_text" } }, "ds-1");
    assert.equal(schema.sourceFilenameProperty, "filename");
    assert.equal(schema.lastModifiedProperty, null);
    const properties = buildPageProperties(schema, {
      title: "a",
      filename: "a.txt",
      mtimeMs: 0,
      body: "",
    });
    assert.equal("Last Modified" in properties, false);
  });

  it("ignores a Source Filename property that is not text", () => {
    const schema = mapSchema(
      { Name: { type: "title" }, "Source Filename": { type: "files" } },
      "ds-1",
    );
    assert.equal(schema.sourceFilenameProperty, null);
  });
});
