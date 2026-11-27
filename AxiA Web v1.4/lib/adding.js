// Adding references from a request, for /api/library/add and /api/projects/<id>/add. Server only.
//   image file:  body = the image bytes, content-type image/*, ?name=<file name>
//   links:       JSON { urls: ["https://…", …] }  (image addresses, Pinterest pins and boards, Are.na blocks and
//                channels, Behance and Dribbble projects, any page with a preview image)
//   by address:  JSON { items: [{ image_url, page_url, title, source }] }  (the browser extension)
// -> { added: [library id], errors: [{ item, error }] }. Throws if the analyser is off.
import { addFile, addImage, addLink } from "./axia.js";

// The analyser's errors are technical; say what happened in plain words.
export function friendly(msg = "", url = "") {
  if (/fetch failed|ECONNREFUSED/i.test(msg)) return "The AI analyser (axia-prototype) is off. Start it and try again.";
  if (/instagram\.com/.test(url) && /login|preview|HTTP Error|urlopen|timed out/i.test(msg)) return "Instagram didn't show this post without a login. Right-click the image with the AxiA extension instead.";
  if (/urlopen|Tunnel|timed out|HTTP Error|Name or service|SSL|login/i.test(msg)) return "Couldn't open that link. The site may need a login: right-click the image with the AxiA extension, or save it and drop it here.";
  if (/too small|empty/i.test(msg)) return "That image is too small to read.";
  return msg.slice(0, 200);
}

const OFF = /fetch failed|ECONNREFUSED/i;

export async function addFromRequest(request) {
  const added = [], errors = [];
  const type = request.headers.get("content-type") ?? "";
  const fail = (item, e, url) => {
    if (OFF.test(e.message)) throw e;
    errors.push({ item, error: friendly(e.message, url) });
  };
  if (type.startsWith("image/")) {
    const name = new URL(request.url).searchParams.get("name") ?? "";
    try { added.push(await addFile(Buffer.from(await request.arrayBuffer()), name)); }
    catch (e) { fail(name || "image", e); }
    return { added, errors };
  }
  const { urls = [], items = [] } = await request.json().catch(() => ({}));
  for (const item of items.filter((i) => i?.image_url).slice(0, 50)) {
    try { added.push(await addImage(item)); }
    catch (e) { fail(item.page_url || item.image_url.slice(0, 80), e, item.page_url); }
  }
  for (const url of urls.filter((u) => /^https?:\/\//.test(u)).slice(0, 20)) {
    try {
      const ids = await addLink(url);
      if (ids.length) added.push(...ids); else errors.push({ item: url, error: "No image found at that link." });
    } catch (e) { fail(url, e, url); }
  }
  return { added: [...new Set(added)], errors };
}

export const ANALYSER_OFF = { error: "The AI analyser (axia-prototype) is off. Start it and try again." };
