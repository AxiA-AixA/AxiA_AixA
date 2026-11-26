// axia-prototype (python3 app.py) does the AI analysis and keeps the library.
// AxiA Web v2 reads that library and adds to it (files, links) on a project's behalf.
export const AXIA = "http://127.0.0.1:8770";

// Designer pages run on the same computer as the analyser, so they load images from it directly
// (fast). A shared brief can be opened elsewhere, so it goes through /api/img instead.
// `thumb` is a small copy (400 px) for grids and the map; `image` is the original.
const direct = (kind, file) => `http://localhost:8770/${kind}/${encodeURIComponent(file)}`;
export const directImg = (file) => direct("img", file);
export const directThumb = (file) => direct("thumb", file);
export const imgUrl = (file, { thumb = false } = {}) => `/api/img/${encodeURIComponent(file)}${thumb ? "?thumb=1" : ""}`;

// The prototype's library: { online, queue, items: [{ id, file, url, title, image, fields, group_name, status, tags, colors, added }] }.
// status: "queued" (waiting for AI), "tagged", "failed", "new" (auto-tagging off).
export async function readLibrary() {
  try {
    const d = await fetch(`${AXIA}/api/library`, { cache: "no-store", signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    return { online: true, queue: d.queue ?? 0, items: d.items.map(toEntry) };
  } catch {
    return { online: false, queue: 0, items: [] };
  }
}

function toEntry(i) {
  return {
    id: i.id, file: i.file, url: i.page_url || null, title: i.title, image: directImg(i.file), thumb: directThumb(i.file), added: i.added,
    pages: i.pages ?? [], imageUrl: i.image_url ?? "",
    fields: i.fields?.length ? i.fields : i.field ? [i.field] : [], group_name: i.group_name, status: i.status, error: i.error ?? null,
    tags: [...new Set([...(i.user_tags ?? []), ...(i.tags ?? [])])], colors: i.colors ?? [],
  };
}

// Add an image file (bytes) to the library. Returns its library id.
export async function addFile(bytes, name = "") {
  const res = await fetch(`${AXIA}/api/upload?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes, signal: AbortSignal.timeout(20000) });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.error ?? "The analyser couldn't take this image.");
  return d.id;
}

// Add whatever a link points to (an image, a Pinterest pin, any page's preview image).
// The analyser doesn't say which item it made, so compare the library before and after;
// if nothing new appeared, the image was already there: find it by its page or image address.
export async function addLink(url) {
  const before = new Set((await readLibrary()).items.map((i) => i.id));
  const res = await fetch(`${AXIA}/api/add_link`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(180000), // an Are.na channel brings in every block
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? "That link didn't give an image.");
  const after = (await readLibrary()).items;
  const fresh = after.filter((i) => !before.has(i.id)).map((i) => i.id);
  if (fresh.length) return fresh;
  const same = (u) => u && u.replace(/\/$/, "") === url.replace(/\/$/, "");
  return after.filter((i) => same(i.url) || same(i.imageUrl) || i.pages.some(same)).map((i) => i.id).slice(0, 1);
}
