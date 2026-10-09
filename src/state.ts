import fs from "node:fs/promises";
import path from "node:path";

export type FileState = {
  pageId: string;
  hash: string;
  mtimeMs: number;
  size: number;
};

export type SyncState = {
  files: Record<string, FileState>;
};

const STATE_FILE = ".transcript-loader-state.json";

export function stateFilePath(cwd = process.cwd()): string {
  return path.join(cwd, STATE_FILE);
}

export async function loadState(filePath = stateFilePath()): Promise<SyncState> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SyncState;
    if (!parsed || typeof parsed !== "object" || typeof parsed.files !== "object") {
      return { files: {} };
    }
    return { files: parsed.files ?? {} };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { files: {} };
    throw error;
  }
}

export async function saveState(state: SyncState, filePath = stateFilePath()): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function isUnchanged(previous: FileState | undefined, file: { hash: string; mtimeMs: number; size: number }): boolean {
  if (!previous) return false;
  return previous.hash === file.hash && previous.size === file.size;
}
