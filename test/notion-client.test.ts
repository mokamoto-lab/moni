import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createNotionStore } from "../src/notion.ts";

type Captured = { method: string; url: string; body: unknown };

function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

describe("createNotionStore against a mock Notion API", () => {
  const captured: Captured[] = [];
  let server: http.Server;
  let baseUrl: string;
  let pages: Array<{ id: string; filename: string }> = [];

  before(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk as Buffer));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const body = raw ? JSON.parse(raw) : null;
        captured.push({ method: req.method ?? "", url: req.url ?? "", body });

        if (req.method === "GET" && req.url?.startsWith("/v1/databases/")) {
          json(res, 200, {
            object: "database",
            id: "db-1",
            data_sources: [{ id: "ds-1", name: "Transcripts" }],
          });
          return;
        }
        if (req.method === "GET" && req.url === "/v1/data_sources/ds-1") {
          json(res, 200, {
            object: "data_source",
            id: "ds-1",
            properties: {
              Name: { type: "title", name: "Name" },
              "Source Filename": { type: "rich_text", name: "Source Filename" },
              "Last Modified": { type: "date", name: "Last Modified" },
            },
          });
          return;
        }
        if (req.method === "POST" && req.url === "/v1/data_sources/ds-1/query") {
          const filename = body?.filter?.rich_text?.equals;
          const match = pages.find((p) => p.filename === filename);
          json(res, 200, {
            object: "list",
            results: match ? [{ object: "page", id: match.id }] : [],
            has_more: false,
            next_cursor: null,
          });
          return;
        }
        if (req.method === "POST" && req.url === "/v1/pages") {
          const filename =
            body?.properties?.["Source Filename"]?.rich_text?.[0]?.text?.content ?? "unknown";
          const page = { id: `page-${pages.length + 1}`, filename };
          pages.push(page);
          json(res, 200, { object: "page", id: page.id });
          return;
        }
        if (req.method === "PATCH" && req.url?.startsWith("/v1/pages/")) {
          json(res, 200, { object: "page", id: req.url.split("/")[3] });
          return;
        }
        if (req.method === "PATCH" && req.url?.includes("/children")) {
          json(res, 200, { object: "list", results: [] });
          return;
        }
        json(res, 404, { object: "error", message: `unhandled ${req.method} ${req.url}` });
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("creates then updates a page through the official client", async () => {
    captured.length = 0;
    pages = [];

    const store = createNotionStore("ntn_test", "277d32ac-1114-4ae6-b93a-e9f15cd3e6f5", { baseUrl });
    const schema = await store.loadSchema();
    assert.equal(schema.dataSourceId, "ds-1");
    assert.equal(schema.sourceFilenameProperty, "Source Filename");

    const missing = await store.findPageId(schema, { filename: "a.txt", title: "a" });
    assert.equal(missing, null);

    const id = await store.createPage(schema, {
      title: "a",
      filename: "a.txt",
      mtimeMs: Date.parse("2026-10-08T00:00:00.000Z"),
      body: "hello",
    });
    assert.equal(id, "page-1");

    const found = await store.findPageId(schema, { filename: "a.txt", title: "a" });
    assert.equal(found, "page-1");

    await store.updatePage(schema, id, {
      title: "a",
      filename: "a.txt",
      mtimeMs: Date.parse("2026-10-08T01:00:00.000Z"),
      body: "hello again",
    });

    const created = captured.find((c) => c.method === "POST" && c.url === "/v1/pages");
    assert.ok(created);
    const createBody = created.body as {
      parent: { data_source_id: string };
      properties: { Name: { title: Array<{ text: { content: string } }> } };
    };
    assert.equal(createBody.parent.data_source_id, "ds-1");
    assert.equal(createBody.properties.Name.title[0]?.text.content, "a");

    const updated = captured.find(
      (c) =>
        c.method === "PATCH" &&
        Boolean(c.url?.startsWith("/v1/pages/")) &&
        (c.body as { erase_content?: boolean }).erase_content === true,
    );
    assert.ok(updated);
  });
});
