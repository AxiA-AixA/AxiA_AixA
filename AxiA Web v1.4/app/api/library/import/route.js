import { AXIA } from "@/lib/axia";
import { ANALYSER_OFF } from "@/lib/adding";

export const dynamic = "force-dynamic";

// POST the JSON from the Instagram saved-posts collector extension (v0.2) -> the analyser adds every post.
// -> { added, new, failed } (failed: usually thumbnail links that have expired)
export async function POST(request) {
  try {
    const res = await fetch(`${AXIA}/api/import_json`, {
      method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
      signal: AbortSignal.timeout(15 * 60000), // a big export takes minutes
    });
    return Response.json(await res.json(), { status: res.status });
  } catch { return Response.json(ANALYSER_OFF, { status: 503 }); }
}
