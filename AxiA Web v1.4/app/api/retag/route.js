import { AXIA } from "@/lib/axia";

// POST { ids } -> asks the analyser to try these images again (after "Couldn't analyse").
export async function POST(request) {
  const { ids = [] } = await request.json().catch(() => ({}));
  try {
    const res = await fetch(`${AXIA}/api/retag`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, statuses: ["failed", "new"] }), signal: AbortSignal.timeout(5000),
    });
    return Response.json(await res.json(), { status: res.status });
  } catch {
    return Response.json({ error: "The AI analyser (axia-prototype) is off." }, { status: 503 });
  }
}
