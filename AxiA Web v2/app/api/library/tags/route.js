import { readLibrary, setUserTags } from "@/lib/axia";

export const dynamic = "force-dynamic";

// POST { ids: [id], add?: [tag], remove?: [tag] } -> { items: [{ id, userTags }] }
// Tags the designer adds by hand, on one image or many at once. They count like AI tags everywhere
// (map, search, spec) and are never changed by re-analysis.
export async function POST(request) {
  const { ids = [], add = [], remove = [] } = await request.json().catch(() => ({}));
  const clean = (list) => [...new Set(list.map((t) => String(t).replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean))];
  const plus = clean(add), minus = new Set(clean(remove).map((t) => t.toLowerCase()));
  const lib = await readLibrary();
  if (!lib.online) return Response.json({ error: "The AI analyser (axia-prototype) is off. Start it and try again." }, { status: 503 });
  const byId = new Map(lib.items.map((i) => [i.id, i]));
  const out = [];
  for (const id of ids.slice(0, 500)) {
    const e = byId.get(id);
    if (!e) continue;
    const have = e.userTags.filter((t) => !minus.has(t.toLowerCase()));
    const next = [...have, ...plus.filter((t) => !have.some((h) => h.toLowerCase() === t.toLowerCase()))];
    try { await setUserTags(id, next); out.push({ id, userTags: next }); }
    catch (err) { return Response.json({ error: err.message, items: out }, { status: 502 }); }
  }
  return Response.json({ items: out });
}
