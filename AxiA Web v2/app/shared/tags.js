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
