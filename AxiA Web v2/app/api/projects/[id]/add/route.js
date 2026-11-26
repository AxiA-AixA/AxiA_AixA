import { addFile, addLink } from "@/lib/axia";
import { getProject, updateProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

// The analyser's errors are technical; say what happened in plain words.
function friendly(msg = "") {
  if (/urlopen|Tunnel|timed out|HTTP Error|Name or service|SSL/i.test(msg)) return "Couldn't open that link. The site may need a login: try right-clicking the image with the AxiA extension, or save it and drop it here.";
  if (/too small|empty/i.test(msg)) return "That image is too small to read.";
  if (/fetch failed|ECONNREFUSED/i.test(msg)) return "The AI analyser (axia-prototype) is off. Start it and try again.";
  return msg.slice(0, 200);
}

// POST, adds references straight into a project (and the library, through the analyser):
// - an image file: body = the image bytes, content-type image/*, ?name=<file name>
// - links: JSON { urls: ["https://…", …] } (image addresses, Pinterest pins, any page with a preview image)
// -> { refs, added: [id], errors: [{ item, error }] }
export async function POST(request, { params }) {
  const id = (await params).id;
  const p = getProject(id);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const added = [], errors = [];
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.startsWith("image/")) {
      const name = new URL(request.url).searchParams.get("name") ?? "";
      try { added.push(await addFile(Buffer.from(await request.arrayBuffer()), name)); }
      catch (e) { errors.push({ item: name || "image", error: friendly(e.message) }); }
    } else {
      const { urls = [] } = await request.json().catch(() => ({}));
      for (const url of urls.filter((u) => /^https?:\/\//.test(u)).slice(0, 20)) {
        try {
          const ids = await addLink(url);
          if (ids.length) added.push(...ids); else errors.push({ item: url, error: "No image found at that link." });
        } catch (e) { errors.push({ item: url, error: friendly(e.message) }); }
      }
    }
  } catch {
    return Response.json({ error: "The AI analyser (axia-prototype) is off. Start it and try again." }, { status: 503 });
  }
  const fresh = getProject(id); // re-read: other adds may have landed meanwhile
  const refs = [...fresh.refs, ...added.filter((a) => !fresh.refs.includes(a))];
  updateProject(id, { refs });
  return Response.json({ refs, added, errors });
}
