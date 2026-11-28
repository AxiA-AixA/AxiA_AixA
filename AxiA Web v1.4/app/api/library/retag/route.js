import { AXIA } from "@/lib/axia";
import { ANALYSER_OFF } from "@/lib/adding";

export const dynamic = "force-dynamic";

// POST { ids } -> analyse those references again; { statuses: ["failed"] } -> every one with that status.
// -> { queued: n }
export async function POST(request) {
  try {
    const res = await fetch(`${AXIA}/api/retag`, {
      method: "POST", headers: { "content-type": "application/json" }, body: await request.text(), signal: AbortSignal.timeout(20000),
    });
    return Response.json(await res.json(), { status: res.status });
  } catch { return Response.json(ANALYSER_OFF, { status: 503 }); }
}
