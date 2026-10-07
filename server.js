import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { createLocationPage } from "./notion.js";

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 10_000;
// Automatic updates closer together than this are acknowledged but not saved.
const MIN_INTERVAL_MS = (Number(process.env.MIN_INTERVAL_MINUTES ?? 30) || 0) * 60_000;
// Phones don't report on the exact minute, so allow a little slack.
const INTERVAL_GRACE_MS = 2 * 60_000;
let lastAutoSavedAt = 0;

const STATIC_FILES = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/manifest.webmanifest": ["public/manifest.webmanifest", "application/manifest+json"],
};

for (const name of ["NOTION_TOKEN", "NOTION_DATABASE_ID"]) {
  if (!process.env[name]) console.warn(`⚠️  ${name} is not set — see .env.example`);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// Accepts the password from the X-App-Password header (web page, Shortcuts)
// or from HTTP Basic auth with any username (OwnTracks).
function givenPassword(req) {
  const header = req.headers["x-app-password"];
  if (header) return header;
  const [scheme, encoded] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return "";
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  return decoded.slice(decoded.indexOf(":") + 1);
}

function passwordOk(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  const given = Buffer.from(givenPassword(req));
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseLocation(body) {
  const { latitude, longitude, accuracy, capturedAt, note } = body ?? {};
  if (typeof latitude !== "number" || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== "number" || longitude < -180 || longitude > 180) return null;
  return {
    latitude,
    longitude,
    accuracy: typeof accuracy === "number" ? accuracy : null,
    capturedAt: Number.isNaN(Date.parse(capturedAt)) ? new Date().toISOString() : capturedAt,
    note: typeof note === "string" ? note.trim() : "",
  };
}

async function handleLocation(req, res) {
  if (!passwordOk(req)) return sendJson(res, 401, { error: "Wrong password" });

  let location;
  try {
    location = parseLocation(await readJson(req));
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }
  if (!location) return sendJson(res, 400, { error: "latitude and longitude must be valid numbers" });

  try {
    const page = await createLocationPage(location);
    sendJson(res, 201, { url: page.url });
  } catch (err) {
    console.error(err);
    sendJson(res, 502, { error: err.message });
  }
}

// OwnTracks HTTP mode: https://owntracks.org/booklet/tech/http/
// It expects a 2xx with a JSON array, otherwise it queues and retries the message.
async function handleOwnTracks(req, res) {
  if (!passwordOk(req)) return sendJson(res, 401, { error: "Wrong password" });

  let msg;
  try {
    msg = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }
  if (msg?._type !== "location") return sendJson(res, 200, []);

  const location = parseLocation({
    latitude: msg.lat,
    longitude: msg.lon,
    accuracy: msg.acc,
    capturedAt: typeof msg.tst === "number" ? new Date(msg.tst * 1000).toISOString() : undefined,
    note: ["Auto (OwnTracks)", typeof msg.batt === "number" && `battery ${msg.batt}%`].filter(Boolean).join(" · "),
  });
  if (!location) return sendJson(res, 400, { error: "lat and lon must be valid numbers" });

  const now = Date.now();
  if (now - lastAutoSavedAt < MIN_INTERVAL_MS - INTERVAL_GRACE_MS) return sendJson(res, 200, []);

  try {
    await createLocationPage(location);
    lastAutoSavedAt = now;
    sendJson(res, 200, []);
  } catch (err) {
    console.error(err);
    sendJson(res, 502, { error: err.message });
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (req.method === "POST" && pathname === "/api/location") return handleLocation(req, res);
  if (req.method === "POST" && pathname === "/api/owntracks") return handleOwnTracks(req, res);
  if (req.method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, { passwordRequired: Boolean(process.env.APP_PASSWORD) });
  }

  const file = req.method === "GET" && STATIC_FILES[pathname];
  if (!file) return sendJson(res, 404, { error: "Not found" });
  const [path, type] = file;
  res.writeHead(200, { "Content-Type": type });
  res.end(await readFile(new URL(path, import.meta.url)));
}).listen(PORT, () => console.log(`moni running at http://localhost:${PORT}`));
