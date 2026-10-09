import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  isTextLikePath,
  looksLikeBinary,
  readTranscriptFile,
  scanSourceFolder,
  titleFromFilename,
} from "../src/files.ts";

describe("files", () => {
  it("uses the filename without extension as the title", () => {
    assert.equal(titleFromFilename("standup-2026-10-08.vtt"), "standup-2026-10-08");
    assert.equal(titleFromFilename("notes.md"), "notes");
    assert.equal(titleFromFilename("noext"), "noext");
  });

  it("accepts transcript-like extensions and rejects binaries by extension", () => {
    assert.equal(isTextLikePath("a.txt"), true);
    assert.equal(isTextLikePath("a.md"), true);
    assert.equal(isTextLikePath("a.vtt"), true);
    assert.equal(isTextLikePath("a.srt"), true);
    assert.equal(isTextLikePath("a.png"), false);
    assert.equal(isTextLikePath("a.mp3"), false);
  });

  it("detects NUL-containing buffers as binary", () => {
    assert.equal(looksLikeBinary(Buffer.from("hello")), false);
    assert.equal(looksLikeBinary(Buffer.from([0x00, 0x01, 0x02])), true);
  });

  describe("scanSourceFolder", () => {
    let dir: string;

    before(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "transcripts-"));
      await fs.writeFile(path.join(dir, "meeting.txt"), "hello from the call");
      await fs.writeFile(path.join(dir, "captions.vtt"), "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi");
      await fs.writeFile(path.join(dir, "skip.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));
      await fs.mkdir(path.join(dir, "nested"));
      await fs.writeFile(path.join(dir, "nested", "notes.md"), "# notes");
      await fs.writeFile(path.join(dir, ".hidden.txt"), "ignore");
    });

    after(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it("reads text files recursively and skips binaries and hidden files", async () => {
      const files = await scanSourceFolder(dir);
      assert.deepEqual(
        files.map((f) => f.relativePath),
        ["captions.vtt", "meeting.txt", "nested/notes.md"],
      );
      const meeting = files.find((f) => f.filename === "meeting.txt");
      assert.equal(meeting?.title, "meeting");
      assert.equal(meeting?.body, "hello from the call");
      assert.equal(
        meeting?.hash,
        createHash("sha256").update("hello from the call").digest("hex"),
      );
    });

    it("returns null for binary files even with a text extension", async () => {
      const binaryTxt = path.join(dir, "fake.txt");
      await fs.writeFile(binaryTxt, Buffer.from([0, 1, 2, 3, 4]));
      assert.equal(await readTranscriptFile(binaryTxt, dir), null);
    });
  });
});
