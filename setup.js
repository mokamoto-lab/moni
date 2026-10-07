// Creates the "Location log" database under a Notion page you've shared with your integration.
// Usage: npm run setup -- <parent-page-id-or-url>
import { notion, LOCATION_PROPERTIES } from "./notion.js";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npm run setup -- <parent-page-id-or-url>");
  process.exit(1);
}

// Accept a raw ID or a Notion URL; the page ID is the trailing 32 hex characters.
const match = arg.replace(/-/g, "").match(/[0-9a-f]{32}(?=[^0-9a-f]*$)/i);
if (!match) {
  console.error(`Could not find a Notion page ID in "${arg}"`);
  process.exit(1);
}

try {
  const db = await notion("/databases", {
    parent: { type: "page_id", page_id: match[0] },
    icon: { type: "emoji", emoji: "📍" },
    title: [{ text: { content: "Location log" } }],
    properties: LOCATION_PROPERTIES,
  });
  console.log(`Created database: ${db.url}`);
  console.log(`\nAdd this to your .env:\nNOTION_DATABASE_ID=${db.id}`);
} catch (err) {
  console.error(err.message);
  console.error("Make sure the parent page is shared with your integration (••• → Connections).");
  process.exit(1);
}
