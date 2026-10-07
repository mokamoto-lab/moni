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
