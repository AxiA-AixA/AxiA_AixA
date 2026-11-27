// Read the preview image and title a page advertises (og:image, then twitter:image).
export function parseOg(html, pageUrl) {
  const meta = (key) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"))?.[0];
    return tag?.match(/content=(["'])(.*?)\1/i)?.[2];
  };
  const raw = meta("og:image") ?? meta("og:image:url") ?? meta("twitter:image");
  const title = meta("og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  let image = null;
  if (raw) {
    try { image = new URL(raw.replaceAll("&amp;", "&"), pageUrl).href; } catch {}
  }
  return { image, title: title ? decode(title).trim() || null : null };
}

// "Instagram (&#064;instagram) &#x2022;" -> "Instagram (@instagram) •"
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] !== "#" ? NAMED[e.toLowerCase()] ?? m
    : String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))));
}
