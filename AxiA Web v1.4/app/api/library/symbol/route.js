import { readFile } from "node:fs/promises";
import path from "node:path";
import { addImage } from "@/lib/axia";
import { ANALYSER_OFF } from "@/lib/adding";

export const dynamic = "force-dynamic";

// POST -> puts the AxiA symbol image (public/brand/AxiA_Symbol_500.png) in the library, so the map's
// default lens has its tags. The map calls this by itself when the symbol is missing. -> { id }
export async function POST() {
  try {
    const file = await readFile(path.join(process.cwd(), "public/brand/AxiA_Symbol_500.png"));
    const id = await addImage({ image_url: `data:image/png;base64,${file.toString("base64")}`, title: "AxiA symbol", source: "axia" });
    return Response.json({ id });
  } catch (e) {
    if (e?.code === "ENOENT") return Response.json({ error: "public/brand/AxiA_Symbol_500.png is missing." }, { status: 500 });
    return Response.json(e?.message ? { error: e.message } : ANALYSER_OFF, { status: 503 });
  }
}
