"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { latestVotes, summarise } from "@/lib/spec";
import { AxiaLogotype, AxiaSymbol } from "../../../Brand";

// Swatch colours for the palette names the analyser uses.
const SWATCH = {
  White: "#f4f4f2", Grey: "#8a8a8a", Gray: "#8a8a8a", Black: "#111", Red: "#d23b2f", Orange: "#ec7a2c", Yellow: "#f2c94c",
  Green: "#3f9b5a", Blue: "#2f6fd6", Purple: "#7c4ad8", Pink: "#ec8fb5", Brown: "#8a5a3c", Beige: "#e4d3b4", Cream: "#f3ead6",
  Navy: "#1d2b57", Teal: "#1f8a8a", Gold: "#c9a227", Silver: "#c0c0c0",
};

// The outcome of a project: one page with what designer and client agreed, what is still open,
// the palette and the key references, and who agreed when. Print or save it as a PDF to attach
// to a proposal or a contract, or copy it as text into an email.
export default function Agreed({ id }) {
  const [p, setP] = useState(null);
  const [lib, setLib] = useState({ items: [] });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then((r) => r.json()).then(setP).catch(() => {});
    fetch("/api/library").then((r) => r.json()).then(setLib).catch(() => {});
  }, [id]);

  const votes = useMemo(() => latestVotes(p?.responses), [p]);
  const byFile = useMemo(() => new Map(lib.items.map((i) => [i.file, i])), [lib]);

  if (!p) return <p className="muted">Loading…</p>;
  if (!p.shared) return (
    <section className="lab">
      <h1>No agreed brief yet</h1>
      <p>Share the spec with your client first. Their answers make this page. <Link href={`/project/${id}`}>Back to the project</Link></p>
    </section>
  );

  const items = p.shared.items;
  const agreed = items.filter((i) => votes[i.key]?.vote === "agree");
  const open = items.filter((i) => votes[i.key]?.vote === "unsure" || votes[i.key]?.vote === "disagree");
  const waiting = items.filter((i) => !votes[i.key]?.vote);
  const palette = agreed.filter((i) => i.category === "Palette");
  const look = agreed.filter((i) => i.category !== "Palette");
  const summary = summarise(look);
  const last = p.responses.at(-1);
  const done = agreed.length === items.length;

  // Key references: the images that carry the most agreed points.
  const agreedTags = new Set(agreed.map((i) => i.tag));
  const score = new Map();
  for (const it of agreed) for (const f of it.examples) score.set(f, (score.get(f) ?? 0) + 1);
  const keyRefs = [...score].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f]) => byFile.get(f)).filter(Boolean);

  const asText = () => [
    `Visual brief: ${p.name}${p.client ? ` for ${p.client}` : ""}`,
    p.word ? `What “${p.word}” means for this project${summary ? `: ${summary}.` : ""}` : summary,
    "",
    `Agreed (${agreed.length} of ${items.length}):`,
    ...agreed.map((i) => `✓ ${i.tag}${i.meaning ? ` (${i.meaning})` : ""}${i.note ? ` – ${i.note}` : ""}`),
    ...(open.length ? ["", "To discuss before the first draft:", ...open.map((i) => `${votes[i.key].vote === "disagree" ? "✕" : "?"} ${i.tag}${votes[i.key].comment ? ` – “${votes[i.key].comment}”` : ""}`)] : []),
    ...(waiting.length ? ["", `Not answered yet: ${waiting.map((i) => i.tag).join(", ")}`] : []),
    "",
    last ? `Answered by ${last.name || "the client"} on ${new Date(last.at).toLocaleDateString()}` : "",
  ].join("\n");
  function copy() {
    navigator.clipboard?.writeText(asText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <article className="agreed">
      <div className="agreed-actions no-print">
        <Link href={`/project/${id}`} className="back">← {p.name}</Link>
        <div className="row">
          <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy as text"}</button>
          <button className="btn primary" onClick={() => window.print()}>Print or save as PDF</button>
        </div>
      </div>

      <header className="agreed-head">
        <div className="lockup" role="img" aria-label="AxiA"><AxiaSymbol height={14} /><AxiaLogotype height={13} /></div>
        <p className="eyebrow">Visual brief{p.client ? ` · ${p.client}` : ""} · {new Date(last?.at ?? p.shared.at).toLocaleDateString()}</p>
        <h1>{p.word ? <>What “{p.word}” means for {p.name}</> : <>The look of {p.name}</>}</h1>
        {summary && <p className="agreed-summary">Agreed: {summary}.</p>}
        <p className={`agreed-status ${done ? "done" : ""}`}>
          {done ? `All ${items.length} points agreed` : `${agreed.length} of ${items.length} points agreed${open.length ? ` · ${open.length} to discuss` : ""}${waiting.length ? ` · ${waiting.length} waiting` : ""}`}
        </p>
      </header>

      {keyRefs.length > 0 && (
        <section className="agreed-refs" aria-label="Key references">
          {keyRefs.map((r) => <img key={r.id} src={r.image} alt={r.title || ""} title={r.tags.filter((t) => agreedTags.has(t)).join(" · ")} />)}
        </section>
      )}

      <section className="agreed-block">
        <h2>The look</h2>
        {look.length ? (
          <ul className="agreed-list">
            {look.map((i) => (
              <li key={i.key}>
                <span className="mark agree">✓</span>
                <div><b>{i.tag}</b> <span className="muted">{i.category}</span>{i.meaning && <p>{i.meaning}</p>}{i.note && <p className="designer-note">{i.note}</p>}{votes[i.key]?.comment && <p className="muted">Client: “{votes[i.key].comment}”</p>}</div>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Nothing agreed yet.</p>}
      </section>

      {palette.length > 0 && (
        <section className="agreed-block">
          <h2>Palette</h2>
          <ul className="swatches">
            {palette.map((i) => <li key={i.key}><span style={{ background: SWATCH[i.tag] ?? "#888" }} />{i.tag}</li>)}
          </ul>
        </section>
      )}

      {open.length > 0 && (
        <section className="agreed-block open">
          <h2>To discuss before the first draft</h2>
          <ul className="agreed-list">
            {open.map((i) => (
              <li key={i.key}>
                <span className={`mark ${votes[i.key].vote}`}>{votes[i.key].vote === "disagree" ? "✕" : "?"}</span>
                <div><b>{i.tag}</b> <span className="muted">{votes[i.key].vote === "disagree" ? "Client disagrees" : "Client isn’t sure"}</span>{votes[i.key].comment && <p>“{votes[i.key].comment}”</p>}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="agreed-block">
          <h2>Not answered yet</h2>
          <p className="muted">{waiting.map((i) => i.tag).join(" · ")}</p>
        </section>
      )}

      <footer className="agreed-sign">
        <div><span className="muted">Answered by</span><b>{last?.name || (last ? "Client" : "—")}</b></div>
        <div><span className="muted">Date</span><b>{last ? new Date(last.at).toLocaleDateString() : "—"}</b></div>
        <div><span className="muted">Made with</span><b>AxiA</b></div>
      </footer>
    </article>
  );
}
