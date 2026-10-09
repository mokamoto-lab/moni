import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { scanSourceFolder } from "../src/files.ts";
import type { DatabaseSchema, NotionStore, PageContent } from "../src/notion.ts";
import { syncFile, syncFolder } from "../src/sync.ts";

function silentLogger() {
  return { info() {}, warn() {} };
}

function mockStore(opts?: { existing?: Record<string, string> }): NotionStore & {
  created: PageContent[];
  updated: Array<{ pageId: string; content: PageContent }>;
  queries: string[];
} {
  const existing = { ...(opts?.existing ?? {}) };
  const created: PageContent[] = [];
  const updated: Array<{ pageId: string; content: PageContent }> = [];
  const queries: string[] = [];
  let nextId = 1;

  const schema: DatabaseSchema = {
    dataSourceId: "ds-1",
    titleProperty: "Name",
    sourceFilenameProperty: "Source Filename",
    lastModifiedProperty: "Last Modified",
    properties: {
      Name: "title",
      "Source Filename": "rich_text",
      "Last Modified": "date",
    },
  };

  return {
    created,
    updated,
    queries,
    async loadSchema() {
      return schema;
    },
    async findPageId(_schema, file) {
      queries.push(file.filename);
      return existing[file.filename] ?? null;
    },
    async createPage(_schema, content) {
      created.push(content);
      const id = `page-${nextId++}`;
      existing[content.filename] = id;
      return id;
    },
    async updatePage(_schema, pageId, content) {
      updated.push({ pageId, content });
    },
  };
}

describe("sync", () => {
  let dir: string;

  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-"));
    await fs.writeFile(path.join(dir, "call.txt"), "first version");
  });

  after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("creates a page on first sync and updates it when the file changes", async () => {
    const store = mockStore();
    const schema = await store.loadSchema();
    const state = { files: {} };
    const [file] = await scanSourceFolder(dir);
    assert.ok(file);

    const first = await syncFile(file, {
      store,
      schema,
      state,
      dryRun: false,
      logger: silentLogger(),
    });
    assert.equal(first, "created");
    assert.equal(store.created.length, 1);
    assert.equal(store.created[0]?.title, "call");
    assert.equal(store.created[0]?.body, "first version");

    const same = await syncFile(file, {
      store,
      schema,
      state,
      dryRun: false,
      logger: silentLogger(),
    });
    assert.equal(same, "skipped");
    assert.equal(store.created.length, 1);
    assert.equal(store.updated.length, 0);

    await fs.writeFile(path.join(dir, "call.txt"), "second version");
    const [changed] = await scanSourceFolder(dir);
    assert.ok(changed);
    const second = await syncFile(changed, {
      store,
      schema,
      state,
      dryRun: false,
      logger: silentLogger(),
    });
    assert.equal(second, "updated");
    assert.equal(store.updated.length, 1);
    assert.equal(store.updated[0]?.content.body, "second version");
    assert.equal(store.updated[0]?.pageId, store.created.length ? state.files["call.txt"]?.pageId : undefined);
  });

  it("reuses an existing Notion page when local state is empty", async () => {
    const store = mockStore({ existing: { "call.txt": "page-existing" } });
    const result = await syncFolder(
      {
        command: "sync",
        dryRun: false,
        sourceFolder: dir,
        notionToken: "ntn_test",
        databaseId: "277d32ac-1114-4ae6-b93a-e9f15cd3e6f5",
      },
      { store, persistState: false, logger: silentLogger() },
    );
    assert.deepEqual(result.created, []);
    assert.deepEqual(result.updated, ["call.txt"]);
    assert.equal(store.created.length, 0);
    assert.equal(store.updated[0]?.pageId, "page-existing");
  });

  it("dry-run without a token lists files and does not call Notion", async () => {
    const store = mockStore();
    const result = await syncFolder(
      {
        command: "sync",
        dryRun: true,
        sourceFolder: dir,
        notionToken: null,
        databaseId: null,
      },
      { store, persistState: false, logger: silentLogger() },
    );
    assert.deepEqual(result.created, ["call.txt"]);
    assert.equal(store.created.length, 0);
    assert.equal(store.queries.length, 0);
  });
});
