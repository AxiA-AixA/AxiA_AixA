import { createProject, readProjects } from "@/lib/projects";
import { latestVotes } from "@/lib/spec";

export const dynamic = "force-dynamic";

// GET -> project summaries for the list. POST { name, client, word } -> the new project.
export async function GET() {
  return Response.json(readProjects().map((p) => {
    const votes = Object.values(latestVotes(p.responses));
    return {
      id: p.id, name: p.name, client: p.client, word: p.word, refs: p.refs.length, updated: p.updated,
      shared: !!p.shared, items: p.shared?.items.length ?? 0,
      agreed: votes.filter((v) => v.vote === "agree").length,
      open: votes.filter((v) => v.vote && v.vote !== "agree").length,
      answered: votes.filter((v) => v.vote).length,
      cover: p.refs.slice(0, 4),
    };
  }));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!String(body.name ?? "").trim()) return Response.json({ error: "Give the project a name." }, { status: 400 });
  return Response.json(createProject(body));
}
