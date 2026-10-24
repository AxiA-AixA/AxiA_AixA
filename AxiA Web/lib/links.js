// Pull every http(s) link out of pasted text. JSON is parsed and re-serialised first
// so escaped slashes ("https:\/\/...") in exports come out as normal URLs.
export function extractLinks(text) {
  let flat = text;
  try { flat = JSON.stringify(JSON.parse(text)); } catch {}
  const found = flat.match(/https?:\/\/[^\s"'<>\\,\]\}]+/g) ?? [];
  return [...new Set(found.map((u) => u.replace(/[.)]+$/, "")))].filter((u) => !isCdn(u));
}

// Instagram/Facebook exports also carry raw media files (scontent-*.cdninstagram.com,
// *.fbcdn.net). They are expiring image URLs, not posts, so they are dropped.
const CDN_HOSTS = ["cdninstagram.com", "fbcdn.net"];
function isCdn(url) {
  const host = hostOf(url);
  return CDN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

// Hub a link hangs off in the graph (By Platform): "www.instagram.com" -> "instagram.com".
export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "other"; }
}
