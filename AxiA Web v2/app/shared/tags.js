// Browser side of /api/library/tags: add or remove hand-made tags on one or many references.
// -> [{ id, userTags }]; throws with the reason if it didn't save.
export async function changeTags(ids, { add = [], remove = [] }) {
  const res = await fetch("/api/library/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, add, remove }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Couldn't save the tags.");
  return d.items;
}

// The tag that puts a reference on the map's first screen (the AxiA symbol references).
export const SHOWCASE_TAG = "AxiA symbol";
export const isShowcase = (e) => e.userTags?.some((t) => t.toLowerCase() === SHOWCASE_TAG.toLowerCase());

// An entry with new hand-made tags, as the library would return it after a reload.
export function withUserTags(e, userTags) {
  const old = new Set(e.userTags.map((t) => t.toLowerCase()));
  const ai = e.tags.filter((t) => !old.has(t.toLowerCase()));
  return { ...e, userTags, tags: [...new Set([...userTags, ...ai])] };
}

// The references on the map: the ones you tagged "AxiA symbol", or, until you tag any, the
// SHOWCASE_COUNT symbol images closest to the AxiA symbol's look (chrome, metal, monochrome, centred).
export const SHOWCASE_COUNT = 5;
const LIKE_SYMBOL = { Symbol: 3, Chrome: 2, Metallic: 2, Glossy: 1, Grayscale: 1, Monochrome: 1, Symmetrical: 1, Geometric: 1, Centered: 1, Render: 1, Futuristic: 1, Studio: 0.5, Black: 0.5, Grey: 0.5, White: 0.5 };
const likeness = (e) => e.tags.reduce((s, t) => s + (LIKE_SYMBOL[t] ?? 0), 0);
export function symbolRefs(entries) {
  const tagged = entries.filter(isShowcase);
  if (tagged.length) return tagged;
  return entries.filter((e) => e.status === "tagged" && e.tags.includes("Symbol"))
    .sort((a, b) => likeness(b) - likeness(a) || a.id.localeCompare(b.id))
    .slice(0, SHOWCASE_COUNT);
}
