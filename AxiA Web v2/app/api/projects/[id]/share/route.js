import { readLibrary } from "@/lib/axia";
import { getProject, shareProject } from "@/lib/projects";
import { buildSpec } from "@/lib/spec";

export const dynamic = "force-dynamic";

// POST -> freezes the current spec (the points the designer kept) as the client's brief.
// The link stays the same when the brief is updated; the client then sees the new version.
export async function POST(_req, { params }) {
  const id = (await params).id;
  const p = getProject(id);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const lib = await readLibrary();
  if (!lib.online) return Response.json({ error: "The AI analyser (axia-prototype) is off. Start it and try again." }, { status: 503 });
  const refs = lib.items.filter((i) => p.refs.includes(i.id));
  const items = buildSpec(refs, p.edits, p.custom).filter((i) => !i.off);
  if (!items.length) return Response.json({ error: "The spec is empty. Add references or points first." }, { status: 400 });
  return Response.json(shareProject(id, items));
}
