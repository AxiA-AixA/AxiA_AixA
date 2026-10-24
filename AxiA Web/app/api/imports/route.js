import { addUrls, readImports } from "@/lib/imports";
import { withAnalysis } from "@/lib/axia";

// GET -> every imported link, with the prototype's analysis attached. POST { urls } -> adds new ones, returns the full list.
export async function GET() {
  return Response.json(await withAnalysis(readImports()));
}

export async function POST(request) {
  const { urls } = await request.json();
  if (!Array.isArray(urls)) return Response.json({ error: "urls must be an array" }, { status: 400 });
  return Response.json(addUrls(urls.filter((u) => /^https?:\/\//.test(u))));
}
