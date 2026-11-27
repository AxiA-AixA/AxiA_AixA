import { addFromRequest, ANALYSER_OFF } from "@/lib/adding";

export const dynamic = "force-dynamic";

// POST -> adds references to the library only. Body: an image file, { urls }, or { items } (see lib/adding.js).
// -> { added: [id], errors: [{ item, error }] }
export async function POST(request) {
  try { return Response.json(await addFromRequest(request)); }
  catch { return Response.json(ANALYSER_OFF, { status: 503 }); }
}
