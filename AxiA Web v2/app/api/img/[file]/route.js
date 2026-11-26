import { AXIA } from "@/lib/axia";

// GET /api/img/<file> -> the thumbnail from axia-prototype. Lets a client who opens a shared
// brief on another computer see the images (the prototype itself only listens on this computer).
export async function GET(_req, { params }) {
  const file = (await params).file;
  if (!/^[\w.-]+$/.test(file)) return new Response("bad name", { status: 400 });
  try {
    const res = await fetch(`${AXIA}/img/${file}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return new Response("not found", { status: 404 });
    return new Response(res.body, {
      headers: { "content-type": res.headers.get("content-type") ?? "image/jpeg", "cache-control": "public, max-age=86400" },
    });
  } catch {
    return new Response("analyser off", { status: 503 });
  }
}
