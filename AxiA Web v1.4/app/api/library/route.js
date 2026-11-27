import crypto from "node:crypto";
import { readLibrary } from "@/lib/axia";

export const dynamic = "force-dynamic";

// GET -> { online, queue, items }: what axia-prototype has analysed (online=false if it isn't running).
// Pages poll this. With If-None-Match set to the last ETag, an unchanged library answers 304 with
// no body, so polling a library of 1,000+ references costs almost nothing.
export async function GET(req) {
  const body = JSON.stringify(await readLibrary());
  const etag = `"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { etag, "cache-control": "no-store" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, "content-type": "application/json" } });
}
