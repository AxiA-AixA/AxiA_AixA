import { deleteProject, getProject, updateProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

// GET -> the project. PUT { name?, client?, word?, refs?, edits?, custom? } -> updated project. DELETE -> { ok }.
export async function GET(_req, { params }) {
  const p = getProject((await params).id);
  return p ? Response.json(p) : Response.json({ error: "not found" }, { status: 404 });
}

export async function PUT(request, { params }) {
  const patch = await request.json().catch(() => ({}));
  const p = updateProject((await params).id, patch);
  return p ? Response.json(p) : Response.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req, { params }) {
  return Response.json({ ok: deleteProject((await params).id) });
}
