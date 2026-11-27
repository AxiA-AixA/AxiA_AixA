import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Imported links live in data/imports.json; their thumbnails are downloaded into
// public/samples/imported/ (survives CDN URL expiry) and then sent to axia-prototype for analysis.
// Read-modify-write is fully synchronous, so concurrent requests can't interleave.
const root = /*turbopackIgnore: true*/ process.cwd();
const FILE = path.join(root, "data/imports.json");
export const THUMB_DIR = path.join(root, "public/samples/imported");

export function readImports() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
}

function update(fn) {
  const list = readImports();
  fn(list);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
  return list;
}

export function addUrls(urls) {
  return update((list) => {
    const known = new Set(list.map((e) => e.url));
    for (const url of urls) if (!known.has(url)) list.push({ url, addedAt: new Date().toISOString() });
  });
}

export function savePreview(url, fields) {
  update((list) => {
    const entry = list.find((e) => e.url === url);
    if (entry) Object.assign(entry, fields, { fetched: true });
  });
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

// Download a thumbnail; returns its public path ("/samples/imported/<hash>.jpg") or null.
export async function downloadThumb(pageUrl, imageUrl) {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  const ext = EXT[res.headers.get("content-type")?.split(";")[0]];
  if (!res.ok || !ext) return null;
  const name = `${crypto.createHash("sha1").update(pageUrl).digest("hex").slice(0, 12)}.${ext}`;
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  fs.writeFileSync(path.join(THUMB_DIR, name), Buffer.from(await res.arrayBuffer()));
  return `/samples/imported/${name}`;
}
