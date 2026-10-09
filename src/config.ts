import fs from "node:fs";
import path from "node:path";

export type Command = "sync" | "watch";

export type AppConfig = {
  command: Command;
  dryRun: boolean;
  sourceFolder: string;
  notionToken: string | null;
  databaseId: string | null;
};

const DEFAULT_SOURCE_FOLDER = "./inbox";

/** Load `.env` from cwd without overriding variables already in the environment. */
export function loadDotEnv(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): void {
  const file = path.join(cwd, ".env");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const trimmed = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) env[key] = value;
  }
}

export function parseArgs(argv: string[]): { command: Command; dryRun: boolean } {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("-"));
  const command = positional[0];

  if (command !== "sync" && command !== "watch") {
    throw new Error("Usage: transcript-loader <sync|watch> [--dry-run]");
  }
  return { command, dryRun };
}

export function extractDatabaseId(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/([0-9a-fA-F]{32})/);
  const compact = fromUrl?.[1] ?? trimmed.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) {
    throw new Error(
      "NOTION_DATABASE_ID must be a 32-character hex id (from the database URL).",
    );
  }
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

export function loadConfig(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env) loadDotEnv(process.cwd(), env);
  const { command, dryRun } = parseArgs(argv);
  const sourceFolder = path.resolve(env.SOURCE_FOLDER?.trim() || DEFAULT_SOURCE_FOLDER);
  const token = env.NOTION_TOKEN?.trim() || null;
  const databaseRaw = env.NOTION_DATABASE_ID?.trim() || null;

  return {
    command,
    dryRun,
    sourceFolder,
    notionToken: token,
    databaseId: databaseRaw ? extractDatabaseId(databaseRaw) : null,
  };
}

export function assertNotionConfig(config: AppConfig): asserts config is AppConfig & {
  notionToken: string;
  databaseId: string;
} {
  if (!config.notionToken) {
    throw new Error("NOTION_TOKEN is not set. Copy .env.example to .env and add your integration secret.");
  }
  if (!config.databaseId) {
    throw new Error("NOTION_DATABASE_ID is not set. Copy the database id from its Notion URL.");
  }
}
