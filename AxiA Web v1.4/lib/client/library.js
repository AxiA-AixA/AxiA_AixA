// Browser side of /api/library.
//
// fetchLibrary(etag) -> { etag, online, queue, items }, or null when nothing changed since `etag`.
// Throws if the site itself can't be reached.
export async function fetchLibrary(etag) {
  const res = await fetch("/api/library", { cache: "no-store", headers: etag ? { "if-none-match": etag } : {} });
  if (res.status === 304) return null;
  if (!res.ok) throw new Error(`library ${res.status}`);
  return { etag: res.headers.get("etag"), ...(await res.json()) };
}

export const OFFLINE = { etag: null, online: false, queue: 0, items: [] };
