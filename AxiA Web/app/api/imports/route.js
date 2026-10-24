import { addUrls, readImports } from "@/lib/imports";

// GET -> every imported link. POST { urls } -> adds new ones, returns the full list.
export async function GET() {
  return Response.json(readImports());
}

export async function POST(request) {
  const { urls } = await request.json();
  if (!Array.isArray(urls)) return Response.json({ error: "urls must be an array" }, { status: 400 });
  return Response.json(addUrls(urls.filter((u) => /^https?:\/\//.test(u))));
}
