# Transcript Loader

Watch a folder on your Mac and upsert transcript files into a Notion database. One page per file. If you drop the same file again, the existing page is updated instead of duplicated.

Requires **Node.js 22+**. No hosted service — it runs locally.

```
./inbox/*.txt, *.md, *.vtt, *.srt  →  Notion database pages
```

## Setup

### 1. Create a Notion integration

1. Open [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Click **New integration**.
3. Name it (for example `Transcript Loader`), pick your workspace, and create it.
4. Copy the **Internal Integration Secret**. That is `NOTION_TOKEN`. It looks like `ntn_…` or `secret_…`.
5. Under **Capabilities**, keep **Read content**, **Update content**, and **Insert content** enabled.

Do not commit this token. Keep it in `.env` only.

### 2. Create (or pick) a database

Create a full-page database in Notion. Required and recommended properties:

| Property | Type | Required? | Used for |
| --- | --- | --- | --- |
| Name (or any Title) | Title | Yes | Page title = filename without extension |
| Source Filename | Text | Strongly recommended | Idempotent matching so re-syncs update instead of duplicating |
| Last Modified | Date | Optional | File last-modified timestamp |

The app inspects the database schema and only writes properties that exist. Extra columns are left alone.

If `Source Filename` is missing, the app matches existing pages by title. That works until two files share the same stem (`meeting.txt` and `meeting.md`).

### 3. Share the database with the integration

Open the database → `•••` → **Connections** → add your integration. Without this step the API returns 404.

### 4. Copy the database ID

From the database URL:

```
https://www.notion.so/Your-workspace/Transcripts-277d32ac11144ae6b93ae9f15cd3e6f5
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

The 32-character hex string is `NOTION_DATABASE_ID`. Dashes are optional.

### 5. Configure env

```sh
cp .env.example .env
```

Edit `.env`:

```
NOTION_TOKEN=ntn_your_secret
NOTION_DATABASE_ID=277d32ac11144ae6b93ae9f15cd3e6f5
SOURCE_FOLDER=./inbox
```

`SOURCE_FOLDER` can be any path, for example `~/Documents/transcripts`. Relative paths resolve from the directory you run the command in.

## Run

```sh
npm install
```

One-shot sync (process the folder once, then exit):

```sh
npm run sync
```

Watch mode (sync once, then pick up new and changed files):

```sh
npm run watch
```

Preview without calling Notion:

```sh
npm run sync -- --dry-run
npm run watch -- --dry-run
```

`--dry-run` without a token lists the files that would be created. With a token and database ID it reports would-create / would-update using the live database.

## What gets synced

Included extensions: `.txt`, `.md`, `.markdown`, `.vtt`, `.webvtt`, `.srt`, `.csv`, `.tsv`, `.json`, `.log`, `.text`, `.transcript`.

Files with NULs or a high ratio of non-text bytes are skipped. Hidden files and folders (names starting with `.`) are ignored.

Each page:

- **Title** — filename minus the extension
- **Body** — file contents as paragraph blocks
- **Source Filename** / **Last Modified** — set when those properties exist on the database

Unchanged files (same SHA-256 hash) are skipped. A local `.transcript-loader-state.json` cache speeds this up; the Notion query is still the source of truth for “does this page already exist?”

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `NOTION_TOKEN is not set` | `.env` exists in the directory you run from, and you used `npm run sync` (it loads `.env`) |
| 404 from Notion | Database is shared with the integration; ID is the 32-char database id, not a page or view id |
| 403 | Integration capabilities include insert/update |
| Duplicate pages | Add a **Source Filename** text property and share the database again, then re-sync |
| Nothing happens in watch | File extension is in the list above; file finished writing (the watcher waits ~400ms after the last write) |

## Develop

```sh
npm test
npm run typecheck
```
