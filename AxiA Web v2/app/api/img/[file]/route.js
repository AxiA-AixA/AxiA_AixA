import { AXIA } from "@/lib/axia";

// GET /api/img/<file>[?thumb=1] -> the image (or its small copy) from axia-prototype. Lets a client
// who opens a shared brief on another computer see the images (the analyser only listens on this one).
// Files are named by a hash of their content, so browsers may keep them for good.
export async function GET(req, { params }) {
  const file = (await params).file;
  if (!/^[\w.-]+$/.test(file)) return new Response("bad name", { status: 400 });
  const kind = new URL(req.url).searchParams.has("thumb") ? "thumb" : "img";
  try {
    const res = await fetch(`${AXIA}/${kind}/${file}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return new Response("not found", { status: 404 });
    return new Response(res.body, {
      headers: { "content-type": res.headers.get("content-type") ?? "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("analyser off", { status: 503 });
  }
}
