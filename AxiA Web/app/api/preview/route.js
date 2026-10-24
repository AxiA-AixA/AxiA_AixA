import { parseOg } from "@/lib/og";
import { downloadThumb, readImports, savePreview } from "@/lib/imports";

// GET /api/preview?url=... -> { url, title, image }. Fetched server-side because
// browsers can't read other sites' HTML (CORS). For imported links the thumbnail is
// downloaded into public/samples/imported and the result is cached in data/imports.json.
// ponytail: fetches any http(s) URL (SSRF) — fine for local testing, add an allowlist before deploying.
export async function GET(request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!/^https?:\/\//.test(url ?? "")) return Response.json({ error: "bad url" }, { status: 400 });

  const entry = readImports().find((e) => e.url === url);
  if (entry?.fetched) return Response.json({ url, title: entry.title ?? null, image: entry.image ?? null });

  let title = null, image = null;
  try {
    const res = await fetch(url, {
      // Pinterest/Instagram only send real og:image to link-preview crawlers. Check against
      // their terms in Test 1 before relying on this.
      headers: { "user-agent": "facebookexternalhit/1.1" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text(); // Pinterest puts og tags ~2MB into the page, so no truncation
    ({ title, image } = parseOg(html, res.url));
    if (image && entry) image = await downloadThumb(url, image);
  } catch {}
  if (entry) savePreview(url, { title, image });
  return Response.json({ url, title, image });
}
