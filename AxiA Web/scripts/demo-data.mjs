// Demo build (DEMO=1): copies the analysed library and its thumbnails into public/demo,
// so the published demo needs no analyser. Runs before `next build`.
import fs from "node:fs";
import path from "node:path";
import { toEntry } from "../lib/entry.mjs";

if (process.env.DEMO !== "1") process.exit(0);
const src = path.resolve("../axia-prototype/axia_data");
const out = path.resolve("public/demo");
const lib = JSON.parse(fs.readFileSync(path.join(src, "library.json"), "utf8"));
const items = Object.values(lib.items).filter((i) => i.status === "tagged");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "img"), { recursive: true });
for (const i of items) fs.copyFileSync(path.join(src, "images", i.file), path.join(out, "img", i.file));
fs.writeFileSync(path.join(out, "library.json"), JSON.stringify({ online: true, items: items.map((i) => toEntry(i, `/demo/img/${i.file}`)) }));
console.log(`demo: ${items.length} references`);
