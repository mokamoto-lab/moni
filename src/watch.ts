import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import { assertNotionConfig, type AppConfig } from "./config.ts";
import { isTextLikePath, readTranscriptFile } from "./files.ts";
import { createNotionStore, type NotionStore } from "./notion.ts";
import { loadState, saveState } from "./state.ts";
import { syncFile, syncFolder } from "./sync.ts";

const WATCH_OPTIONS = {
  ignoreInitial: true,
  ignored: /(^|[\\/])\../,
  awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
};

export async function startWatcher(
  config: AppConfig,
  opts: { store?: NotionStore; persistState?: boolean } = {},
): Promise<{ close: () => Promise<void> }> {
  if (!config.dryRun && !opts.store) {
    assertNotionConfig(config);
  }

  console.log(`Watching ${config.sourceFolder}${config.dryRun ? " (dry-run)" : ""}`);

  const initial = await syncFolder(config, opts);
  console.log(
    `Initial sync: ${initial.created.length} created, ${initial.updated.length} updated, ${initial.skipped.length} skipped`,
  );

  if (config.dryRun && !config.notionToken) {
    const watcher = chokidar.watch(config.sourceFolder, WATCH_OPTIONS);
    watcher.on("add", (filePath) => {
      if (isTextLikePath(filePath)) console.log(`would create  ${path.relative(config.sourceFolder, filePath)}`);
    });
    watcher.on("change", (filePath) => {
      if (isTextLikePath(filePath)) console.log(`would update  ${path.relative(config.sourceFolder, filePath)}`);
    });
    await waitForReady(watcher);
    return { close: () => watcher.close() };
  }

  const store =
    opts.store ??
    (config.notionToken && config.databaseId
      ? createNotionStore(config.notionToken, config.databaseId)
      : null);
  if (!store) {
    throw new Error("Notion store is required unless --dry-run is used without a token.");
  }
  const schema = await store.loadSchema();
  const persist = opts.persistState !== false;
  const state = persist ? await loadState() : { files: {} };

  const handle = async (absPath: string) => {
    try {
      const file = await readTranscriptFile(absPath, config.sourceFolder);
      if (!file) return;
      await syncFile(file, { store, schema, state, dryRun: config.dryRun });
      if (persist && !config.dryRun) await saveState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${absPath}: ${message}`);
    }
  };

  const watcher = chokidar.watch(config.sourceFolder, WATCH_OPTIONS);
  watcher.on("add", (filePath) => void handle(filePath));
  watcher.on("change", (filePath) => void handle(filePath));
  watcher.on("error", (error) => console.error("Watch error:", error));
  await waitForReady(watcher);
  return { close: () => watcher.close() };
}

function waitForReady(watcher: FSWatcher): Promise<void> {
  return new Promise((resolve) => {
    watcher.on("ready", () => resolve());
  });
}

export async function watchFolder(config: AppConfig): Promise<void> {
  await startWatcher(config);
  await new Promise(() => {
    /* run until interrupted */
  });
}
