import fs from "node:fs";
import path from "node:path";
import { readCsv } from "@/lib/csv";
import { readImports } from "@/lib/imports";

export const metadata = { title: "Samples · AxiA" };
export const dynamic = "force-dynamic";

const root = path.join(process.cwd(), "public/samples");
const isImage = (f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f);

// Every folder under public/samples is a category; nested folders are subcategories
// ("graphic/3d"). Returns folders depth-first so children follow their parent.
function collect(rel = "") {
  const entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name);
  const children = entries
    .filter((e) => e.isDirectory())
    .flatMap((e) => collect(rel ? `${rel}/${e.name}` : e.name));
  return rel ? [{ name: rel, depth: rel.split("/").length - 1, files }, ...children] : children;
}

export default function Samples() {
  const categories = collect();
  // labels.csv: file (path under public/samples), tags (";"-separated), source, split
  const labels = new Map(readCsv("data/labels.csv").map((l) => [l.file, l]));
  // tags.csv: tag, definition, example — shown as a tooltip on each tag
  const dictionary = new Map(readCsv("data/tags.csv").map((t) => [t.tag, t.definition]));
  // Thumbnails saved from the home page import: "imported/<hash>.jpg" -> original post
  const imported = new Map(readImports().filter((e) => e.image).map((e) => [e.image.replace("/samples/", ""), e.url]));

  return (
    <section>
      <h1>Samples</h1>
      <p>Labelled examples for testing only. Folder path = category, tags from data/labels.csv.</p>
      {categories.map((c) => (
        <div key={c.name} className="category" style={{ marginLeft: c.depth * 24 }}>
          <h2>{c.name} <span>{c.files.length}</span></h2>
          {c.files.length > 0 && (
            <div className="grid">
              {c.files.map((f) => {
                const file = `${c.name}/${f}`;
                const label = labels.get(file);
                const tags = label?.tags.split(";").map((t) => t.trim()).filter(Boolean) ?? [];
                return (
                  <figure key={f}>
                    <img src={`/samples/${file}`} alt={f} loading="lazy" />
                    <figcaption>
                      {label?.split && <b>{label.split}</b>}
                      {tags.length === 0 && <i>no tags</i>}
                      {tags.map((t) => (
                        <span key={t} className={dictionary.has(t) ? "tag" : "tag unknown"}
                          title={dictionary.get(t) ?? "Not in tags.csv"}>{t}</span>
                      ))}
                      {(label?.source ?? imported.get(file)) && (
                        <a href={label?.source ?? imported.get(file)} target="_blank" rel="noreferrer">source</a>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
