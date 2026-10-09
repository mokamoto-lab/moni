import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { extractDatabaseId, loadConfig, loadDotEnv, parseArgs } from "../src/config.ts";

describe("config", () => {
  it("parses sync and watch with optional dry-run", () => {
    assert.deepEqual(parseArgs(["node", "cli", "sync"]), { command: "sync", dryRun: false });
    assert.deepEqual(parseArgs(["node", "cli", "watch", "--dry-run"]), { command: "watch", dryRun: true });
  });

  it("rejects a missing command", () => {
    assert.throws(() => parseArgs(["node", "cli"]), /Usage/);
  });

  it("normalizes a compact or dashed database id and extracts one from a URL", () => {
    const compact = "277d32ac11144ae6b93ae9f15cd3e6f5";
    const dashed = "277d32ac-1114-4ae6-b93a-e9f15cd3e6f5";
    assert.equal(extractDatabaseId(compact), dashed);
    assert.equal(extractDatabaseId(dashed), dashed);
    assert.equal(
      extractDatabaseId(`https://www.notion.so/workspace/Transcripts-${compact}?v=abc`),
      dashed,
    );
  });

  it("defaults SOURCE_FOLDER to ./inbox and leaves Notion secrets unset", () => {
    const config = loadConfig(["node", "cli", "sync"], {});
    assert.equal(config.sourceFolder, path.resolve("./inbox"));
    assert.equal(config.notionToken, null);
    assert.equal(config.databaseId, null);
  });

  describe("loadDotEnv", () => {
    let dir: string;

    before(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "dotenv-"));
      await fs.writeFile(
        path.join(dir, ".env"),
        'NOTION_TOKEN="ntn_from_file"\nSOURCE_FOLDER=./from-env\n',
      );
    });

    after(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it("fills missing keys and does not override existing ones", () => {
      const env: NodeJS.ProcessEnv = { NOTION_TOKEN: "already-set" };
      loadDotEnv(dir, env);
      assert.equal(env.NOTION_TOKEN, "already-set");
      assert.equal(env.SOURCE_FOLDER, "./from-env");
    });
  });
});
