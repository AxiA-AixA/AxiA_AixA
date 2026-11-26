import { addResponse, findByToken } from "@/lib/projects";

export const dynamic = "force-dynamic";

// The client's side. GET -> the shared brief (nothing else from the project).
// POST { name, items: { [key]: { vote, comment } } } -> saved; the designer sees it on the project page.
function view(p) {
  return { name: p.name, client: p.client, word: p.word, at: p.shared.at, items: p.shared.items };
}

export async function GET(_req, { params }) {
  const p = findByToken((await params).token);
  return p ? Response.json(view(p)) : Response.json({ error: "not found" }, { status: 404 });
}

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const p = addResponse((await params).token, body);
  return p ? Response.json({ ok: true }) : Response.json({ error: "not found" }, { status: 404 });
}
