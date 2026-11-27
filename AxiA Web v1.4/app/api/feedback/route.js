import { addFeedback, readFeedback } from "@/lib/feedback";
import { findByToken } from "@/lib/projects";

export const dynamic = "force-dynamic";

// GET -> every feedback entry (for the summary). POST { kind: "designer" | "client", … } -> { ok }
// A client's feedback names its brief's token; the project name is looked up here.
export async function GET() {
  return Response.json(readFeedback());
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.kind === "client") body.project = findByToken(String(body.token ?? ""))?.name ?? "";
  try { addFeedback(body.kind, body); } catch { return Response.json({ error: "Unknown feedback type." }, { status: 400 }); }
  return Response.json({ ok: true });
}
