import { addFromRequest, ANALYSER_OFF } from "@/lib/adding";
import { getProject, updateProject } from "@/lib/projects";
import { checkProjectWords } from "@/lib/words";

export const dynamic = "force-dynamic";

// POST -> adds references straight into a project (and the library, through the analyser).
// Body: an image file, { urls }, or { items } (see lib/adding.js). -> { refs, added: [id], errors: [{ item, error }] }
export async function POST(request, { params }) {
  const id = (await params).id;
  if (!getProject(id)) return Response.json({ error: "not found" }, { status: 404 });
  let result;
  try { result = await addFromRequest(request); } catch { return Response.json(ANALYSER_OFF, { status: 503 }); }
  const fresh = getProject(id); // re-read: other adds may have landed meanwhile
  const refs = [...fresh.refs, ...result.added.filter((a) => !fresh.refs.includes(a))];
  checkProjectWords(updateProject(id, { refs }));
  return Response.json({ refs, ...result });
}
