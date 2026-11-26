// axia-prototype (python3 app.py) does the AI analysis and keeps the library.
// AxiA Web v2 reads that library; references are added with the Chrome extension
// ("Send to AxiA") or in the prototype app (/reference). The v1 link-import flow is gone.
export const AXIA = "http://127.0.0.1:8770";

// Images go through /api/img so a shared brief works from any computer that can reach this server.
export const imgUrl = (file) => `/api/img/${encodeURIComponent(file)}`;

// The prototype's library: [{ id, file, url, title, image, fields, group_name, status, tags, colors }].
// tags = style tags (plus any tags the user added); colors = the image's main colours.
export async function readLibrary() {
  try {
    const d = await fetch(`${AXIA}/api/library`, { cache: "no-store", signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    return { online: true, items: d.items.map(toEntry) };
  } catch {
    return { online: false, items: [] };
  }
}

function toEntry(i) {
  return {
    id: i.id, file: i.file, url: i.page_url || null, title: i.title, image: imgUrl(i.file),
    fields: i.fields?.length ? i.fields : i.field ? [i.field] : [], group_name: i.group_name, status: i.status,
    tags: [...new Set([...(i.user_tags ?? []), ...(i.tags ?? [])])], colors: i.colors ?? [],
  };
}
