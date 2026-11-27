import { readLibrary } from "@/lib/axia";

export const dynamic = "force-dynamic";

// GET -> { online, items }: what axia-prototype has analysed. online=false if it isn't running.
export async function GET() {
  return Response.json(await readLibrary());
}
