const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export async function notion(path, body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");

  const res = await fetch(`${NOTION_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${data.message ?? res.statusText}`);
  return data;
}

// The database schema used by setup.js and expected by createLocationPage.
export const LOCATION_PROPERTIES = {
  Name: { title: {} },
  Latitude: { number: { format: "number" } },
  Longitude: { number: { format: "number" } },
  "Accuracy (m)": { number: { format: "number" } },
  "Captured at": { date: {} },
  Map: { url: {} },
  Note: { rich_text: {} },
};

export function createLocationPage({ latitude, longitude, accuracy, capturedAt, note }) {
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const when = new Date(capturedAt);

  return notion("/pages", {
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties: {
      Name: { title: [{ text: { content: `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` } }] },
      Latitude: { number: latitude },
      Longitude: { number: longitude },
      "Accuracy (m)": { number: accuracy == null ? null : Math.round(accuracy) },
      "Captured at": { date: { start: when.toISOString() } },
      Map: { url: mapUrl },
      Note: { rich_text: note ? [{ text: { content: note.slice(0, 2000) } }] : [] },
    },
  });
}
