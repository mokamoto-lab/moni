import { assertNotionConfig, type AppConfig } from "./config.ts";
import { scanSourceFolder, type TranscriptFile } from "./files.ts";
import { createNotionStore, type DatabaseSchema, type NotionStore } from "./notion.ts";
import { isUnchanged, loadState, saveState, type SyncState } from "./state.ts";

export type SyncResult = {
  created: string[];
  updated: string[];
  skipped: string[];
  ignored: string[];
};

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

const defaultLogger: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
};

export async function syncFile(
  file: TranscriptFile,
  opts: {
    store: NotionStore;
    schema: DatabaseSchema;
    state: SyncState;
    dryRun: boolean;
    logger?: Logger;
  },
): Promise<"created" | "updated" | "skipped"> {
  const log = opts.logger ?? defaultLogger;
  const previous = opts.state.files[file.relativePath];

  if (previous && isUnchanged(previous, file)) {
    log.info(`skip (unchanged)  ${file.relativePath}`);
    return "skipped";
  }

  if (opts.dryRun) {
    log.info(`${previous ? "would update" : "would create"}  ${file.relativePath}`);
    return previous ? "updated" : "created";
  }

  const existingId = previous?.pageId ?? (await opts.store.findPageId(opts.schema, file));
  const content = {
    title: file.title,
    filename: file.filename,
    mtimeMs: file.mtimeMs,
    body: file.body,
  };

  let pageId: string;
  let action: "created" | "updated";
  if (existingId) {
    await opts.store.updatePage(opts.schema, existingId, content);
    pageId = existingId;
    action = "updated";
    log.info(`updated  ${file.relativePath}`);
  } else {
    pageId = await opts.store.createPage(opts.schema, content);
    action = "created";
    log.info(`created  ${file.relativePath}`);
  }

  opts.state.files[file.relativePath] = {
    pageId,
    hash: file.hash,
    mtimeMs: file.mtimeMs,
    size: file.size,
  };
  return action;
}

export async function syncFolder(
  config: AppConfig,
  opts: {
    store?: NotionStore;
    persistState?: boolean;
    logger?: Logger;
  } = {},
): Promise<SyncResult> {
  const log = opts.logger ?? defaultLogger;
  const result: SyncResult = { created: [], updated: [], skipped: [], ignored: [] };
  const files = await scanSourceFolder(config.sourceFolder);

  if (config.dryRun && !config.notionToken) {
    log.info(`Dry-run (no Notion token). ${files.length} file(s) in ${config.sourceFolder}`);
    for (const file of files) {
      result.created.push(file.relativePath);
      log.info(`would create  ${file.relativePath}`);
    }
    return result;
  }

  assertNotionConfig(config);
  const store = opts.store ?? createNotionStore(config.notionToken, config.databaseId);
  const schema = await store.loadSchema();
  const persist = opts.persistState !== false;
  const state = persist ? await loadState() : { files: {} };

  if (!schema.sourceFilenameProperty) {
    log.warn(
      'No "Source Filename" text property on the database. Matching existing pages by title instead. Add the property to avoid duplicates when titles collide.',
    );
  }

  for (const file of files) {
    const action = await syncFile(file, {
      store,
      schema,
      state,
      dryRun: config.dryRun,
      logger: log,
    });
    result[action].push(file.relativePath);
  }

  if (persist && !config.dryRun) {
    await saveState(state);
  }
  return result;
}
