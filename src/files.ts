import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".vtt",
  ".webvtt",
  ".srt",
  ".csv",
  ".tsv",
  ".json",
  ".log",
  ".text",
  ".transcript",
]);

const SKIP_DIR_NAMES = new Set(["node_modules", ".git", "dist"]);

export type TranscriptFile = {
  absPath: string;
  relativePath: string;
  filename: string;
  title: string;
  extension: string;
  mtimeMs: number;
  size: number;
  hash: string;
  body: string;
};

export function titleFromFilename(filename: string): string {
  const base = path.basename(filename);
  const ext = path.extname(base);
  const title = ext ? base.slice(0, -ext.length) : base;
  return title.trim() || base;
}

export function looksLikeBinary(buffer: Buffer): boolean {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  let odd = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      odd += 1;
    }
  }
  return sample.length > 0 && odd / sample.length > 0.3;
}

export function isTextLikePath(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function readTranscriptFile(
  absPath: string,
  sourceFolder: string,
): Promise<TranscriptFile | null> {
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) return null;
  if (!isTextLikePath(absPath)) return null;

  const buffer = await fs.readFile(absPath);
  if (looksLikeBinary(buffer)) return null;

  const filename = path.basename(absPath);
  return {
    absPath,
    relativePath: path.relative(sourceFolder, absPath).split(path.sep).join("/"),
    filename,
    title: titleFromFilename(filename),
    extension: path.extname(filename).toLowerCase(),
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    hash: createHash("sha256").update(buffer).digest("hex"),
    body: buffer.toString("utf8"),
  };
}

export async function scanSourceFolder(sourceFolder: string): Promise<TranscriptFile[]> {
  const files: TranscriptFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw new Error(`Source folder does not exist: ${sourceFolder}`);
      }
      throw error;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const file = await readTranscriptFile(full, sourceFolder);
      if (file) files.push(file);
    }
  }

  await walk(sourceFolder);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}
