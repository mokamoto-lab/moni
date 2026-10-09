import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { DatabaseSchema, NotionStore, PageContent } from "../src/notion.ts";
import { startWatcher } from "../src/watch.ts";

function mockStore(): NotionStore & { created: PageContent[] } {
  const created: PageContent[] = [];
  const schema: DatabaseSchema = {
    dataSourceId: "ds-1",
    titleProperty: "Name",
    sourceFilenameProperty: "Source Filename",
    lastModifiedProperty: null,
    properties: { Name: "title", "Source Filename": "rich_text" },
  };
  return {
    created,
    async loadSchema() {
      return schema;
    },
    async findPageId() {
      return null;
    },
    async createPage(_schema, content) {
      created.push(content);
      return `page-${created.length}`;
    },
    async updatePage() {},
  };
}

describe("watch", () => {
  let dir: string;

  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "watch-"));
  });

  after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("picks up a new transcript after the initial sync", async () => {
    const store = mockStore();
    const watcher = await startWatcher(
      {
        command: "watch",
        dryRun: false,
        sourceFolder: dir,
        notionToken: "ntn_test",
        databaseId: "277d32ac-1114-4ae6-b93a-e9f15cd3e6f5",
      },
      { store, persistState: false },
    );

    try {
      await fs.writeFile(path.join(dir, "new-call.srt"), "1\n00:00:00,000 --> 00:00:01,000\nHello");
      const started = Date.now();
      while (store.created.length === 0 && Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(store.created.length, 1);
      assert.equal(store.created[0]?.filename, "new-call.srt");
      assert.equal(store.created[0]?.title, "new-call");
    } finally {
      await watcher.close();
    }
  });
});
