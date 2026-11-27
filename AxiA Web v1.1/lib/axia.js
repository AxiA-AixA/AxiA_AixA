import fs from "node:fs";
import path from "node:path";
import { readImports, savePreview } from "./imports";

// axia-prototype (python3 app.py) does the AI analysis and keeps the results in its library.
// AxiA Web only sends it thumbnails and reads the results back.
export const AXIA = "http://127.0.0.1:8770";
const root = /*turbopackIgnore: true*/ process.cwd();

async function send(e) {
  const file = path.join(root, "public", e.image);
  const mime = e.image.endsWith(".png") ? "image/png" : e.image.endsWith(".webp") ? "image/webp" : "image/jpeg";
  await fetch(`${AXIA}/api/add`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      image_url: `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`,
      page_url: e.url,
      title: e.title ?? "",
    }),
    signal: AbortSignal.timeout(10000),
  });
}

// Send every thumbnail the prototype hasn't got yet. Stops quietly if it isn't running;
// the next call picks up where it left off. One run at a time.
let running = null, again = false;
export function syncAll() {
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      for (const e of readImports().filter((e) => e.image && !e.sent)) {
        try { await send(e); } catch { return; } // rejected images (too small etc.) count as sent too
        savePreview(e.url, { sent: true });
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

// The prototype's library, shaped for the graph. Images load straight from the prototype.
export async function readLibrary() {
  try {
    const d = await fetch(`${AXIA}/api/library`, { cache: "no-store", signal: AbortSignal.timeout(2000) }).then((r) => r.json());
    syncAll(); // catch up on thumbnails imported while it was off
    return {
      online: true,
      items: d.items.map((i) => ({
        id: i.id, url: i.page_url || null, title: i.title, image: `http://localhost:8770/img/${i.file}`,
        fields: i.fields?.length ? i.fields : i.field ? [i.field] : [], group_name: i.group_name, status: i.status, tags: [...(i.user_tags ?? []), ...(i.tags ?? [])],
      })),
    };
  } catch {
    return { online: false, items: [] };
  }
}
