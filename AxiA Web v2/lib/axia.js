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
    userTags: i.user_tags ?? [],                        // tags the designer added by hand (Library)
    words: i.words ?? {}, wordsError: i.words_error ?? null, // client words checked by the AI: { word: true/false }
  };
}

// Add an image file (bytes) to the library. Returns its library id.
export async function addFile(bytes, name = "") {
  const res = await fetch(`${AXIA}/api/upload?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes, signal: AbortSignal.timeout(20000) });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.error ?? "The analyser couldn't take this image.");
  return d.id;
}

// Add an image by its address (what the browser extension sends). Returns its library id.
export async function addImage({ image_url, page_url = "", title = "", source = "" }) {
  const res = await fetch(`${AXIA}/api/add`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_url, page_url, title, source }), signal: AbortSignal.timeout(60000),
  });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.error ?? "The analyser couldn't take this image.");
  return d.id;
}

// Replace the hand-added tags of one image.
export async function setUserTags(id, tags) {
  const res = await fetch(`${AXIA}/api/item`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, user_tags: tags }), signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the tags.");
}

// Ask the AI whether each image looks like each word (the client's words that aren't fixed tags).
// Answers arrive in the library as entry.words; already answered pairs are skipped.
export async function askWords(ids, words) {
  if (!ids.length || !words.length) return 0;
  const res = await fetch(`${AXIA}/api/ask`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, words }), signal: AbortSignal.timeout(5000),
  });
  return (await res.json()).queued ?? 0;
}

// Add whatever a link points to (an image, a Pinterest pin, an Are.na block or channel, a Behance or
// Dribbble project, any page's preview image). Returns the library ids it gave, including images that
// were already there. (An older analyser doesn't return ids: then compare the library before and after.)
export async function addLink(url) {
  const before = new Set((await readLibrary()).items.map((i) => i.id));
  const res = await fetch(`${AXIA}/api/add_link`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(180000), // an Are.na channel brings in every block
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? "That link didn't give an image.");
  if (d.ids?.length) return [...new Set(d.ids)]; // newer analyser: says which items the link gave
  const after = (await readLibrary()).items;
  const fresh = after.filter((i) => !before.has(i.id)).map((i) => i.id);
  if (fresh.length) return fresh;
  const same = (u) => u && u.replace(/\/$/, "") === url.replace(/\/$/, "");
  return after.filter((i) => same(i.url) || same(i.imageUrl) || i.pages.some(same)).map((i) => i.id).slice(0, 1);
}
