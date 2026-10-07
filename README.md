# moni

A tiny web app that captures your current location from the browser and logs it to a Notion database: one tap, one row.

Each entry records **latitude, longitude, accuracy, timestamp, a Google Maps link** and an optional **note**.

It has no dependencies and needs only Node.js 22+.

## How it works

```
Phone / browser  ──(Geolocation API)──▶  page  ──POST /api/location──▶  server.js  ──▶  Notion API
```

The Notion token lives only on the server; the browser never sees it.

## Setup

1. **Create a Notion integration** at <https://www.notion.so/my-integrations> and copy its secret.
2. **Share a page with it**: open the Notion page that should hold the log → `•••` → *Connections* → add your integration.
3. **Configure**:
   ```sh
   cp .env.example .env
   # set NOTION_TOKEN in .env
   ```
4. **Create the database** under that page (or skip this and point `NOTION_DATABASE_ID` at an existing database with the same columns):
   ```sh
   npm run setup -- https://www.notion.so/your-page-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Copy the printed `NOTION_DATABASE_ID` into `.env`.
5. **Run it**:
   ```sh
   npm start
   ```
   Open <http://localhost:3000> and tap **Send my location to Notion**.

### Database columns

| Column | Type |
| --- | --- |
| Name | Title |
| Latitude | Number |
| Longitude | Number |
| Accuracy (m) | Number |
| Captured at | Date |
| Map | URL |
| Note | Text |

## Using it on your phone

Browsers only allow location access on **HTTPS** (or `localhost`). To use it on your phone, deploy it somewhere with HTTPS (Render, Railway, Fly.io, …) or tunnel your local server with `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.

Set `APP_PASSWORD` whenever the app is reachable from the internet, so only you can write to your Notion. Then use your browser's **Add to Home Screen** for a one-tap app icon.

## Automatic logging every 30 minutes

Web pages can't read your location in the background, so automatic logging uses the free [OwnTracks](https://owntracks.org) app (iOS and Android). It reports your location to `POST /api/owntracks`. The server saves at most one entry every `MIN_INTERVAL_MINUTES` (default **30**) and quietly drops the rest, so you get a clean log however chatty the phone is.

This needs the server running all the time on a public HTTPS URL (see above), with `APP_PASSWORD` set.

In OwnTracks → **Settings → Connection**:

| Setting | Value |
| --- | --- |
| Mode | HTTP |
| URL | `https://<your-server>/api/owntracks` |
| Authentication | on: any username, password = your `APP_PASSWORD` |

Then pick a monitoring mode: **Significant** is battery-friendly, **Move** reports more often. Phones send fewer updates while you're stationary, so expect gaps when you're sitting still. When you move, entries come in about every 30 minutes. If the server is unreachable (for example a free host waking from sleep), OwnTracks queues the location and retries.

Automatic entries are marked `Auto (OwnTracks)` in the Note column, with your battery level.
