"use client";

import { useState } from "react";
import { SHARE, strength, VOTES } from "@/lib/spec";
import { ENOUGH, plural } from "@/lib/status";

// Step 2: the visual spec read from the references.
// spec: buildSpec items; refs: analysed references; words: checkWords; summary: summarise;
// votes/sharedKeys: the client's answers; setEdit(key, change); custom points: onAddPoint(text), onRemovePoint(key).
export default function SpecPanel({ project, spec, refs, busy, words, summary, votes, sharedKeys, fileToRef, setEdit, onAddPoint, onRemovePoint }) {
  const [newPoint, setNewPoint] = useState("");
  const [openNotes, setOpenNotes] = useState({});
  const clear = spec.filter((i) => strength(i) === "clear");
  const some = spec.filter((i) => strength(i) === "some");
  const someOn = some.filter((i) => !i.off).length;
  const tagCount = refs.reduce((n, r) => n + r.tags.length, 0);
  const list = { refs, votes, sharedKeys, fileToRef, setEdit, openNotes, setOpenNotes, onRemovePoint };

  function addPoint(e) {
    e.preventDefault();
    if (!newPoint.trim()) return;
    onAddPoint(newPoint.trim());
    setNewPoint("");
  }

  return (
    <div className="spec glass" id="step-spec">
      <p className="eyebrow">Visual spec</p>
      <h2 className="spec-title">{project.word ? <>What “{project.word}” means for {project.name}</> : <>The look of {project.name}</>}</h2>

      {refs.length < 3 ? (
        <p className="muted">Add at least {ENOUGH} references. AxiA tags each one, then lists what most of them share. {busy > 0 && `${busy} still being analysed.`}</p>
      ) : (
        <>
          {summary && <p className="spec-summary">These references point to {summary}.</p>}
          <details className="method">
            <summary>Read from {plural(refs.length, "reference")} · {tagCount} AI tags{busy ? ` · ${busy} still analysing` : ""}</summary>
            <p>Each image gets tags from one fixed list (form, material, light, colour, type, mood). A tag becomes a point here when at least {Math.round(SHARE * 100)}% of the references have it. Nothing is invented: every point shows how many references it came from. Turn off what doesn’t belong and add notes in your own words before you share.</p>
          </details>

          <WordCheck words={words} />

          <SpecList title="Clear" hint="in 60%+ of references, or added by you" items={clear} {...list} />
          {some.length > 0 && (
            <details className="some-points">
              <summary>{plural(some.length, "weaker point")} (30–59% of references) · {someOn ? `${someOn} switched on` : "off unless you switch them on"}</summary>
              <SpecList items={some} {...list} />
            </details>
          )}
          <form className="add-point" onSubmit={addPoint}>
            <input value={newPoint} onChange={(e) => setNewPoint(e.target.value)} placeholder="Add a point in your own words, e.g. “No neon, no gradients”" />
            <button className="btn" disabled={!newPoint.trim()}>Add</button>
          </form>
        </>
      )}
    </div>
  );
}

// Does what the client said show in the references? Words that aren't fixed tags are checked by the
// AI on each reference; those that show become points under "Client's words".
function WordCheck({ words }) {
  if (!words.length) return null;
  const pct = (share) => `${Math.round(share * 100)}%`;
  return (
    <div className="word-check">
      <h3>Your client said</h3>
      <ul>
        {words.map((w) => (
          <li key={w.word} className={w.verdict}>
            <b>“{w.word}”</b>
            {w.ai ? (
              <>
                {w.verdict === "shows" && <span>{pct(w.share)} of the references look {w.word}, checked by AI on each one. It’s a point below.</span>}
                {w.verdict === "faint" && <span>only {pct(w.share)} of the references look {w.word} (checked by AI). Ask what they mean, or add references that do.</span>}
                {w.verdict === "missing" && <span>none of these references look {w.word} (checked by AI). Check with your client before you share.</span>}
                {w.verdict === "checking" && <span className="muted">not one of AxiA’s tags, so the AI is checking each reference for it… {w.checked} of {w.total} done</span>}
              </>
            ) : (
              <>
                {w.verdict === "shows" && <span>shows in the references: {w.tags.filter((t) => t.share >= SHARE).map((t) => `${t.tag} ${pct(t.share)}`).join(", ")}</span>}
                {w.verdict === "faint" && <span>only faintly: {w.tags[0].tag} in {pct(w.tags[0].share)}. Ask what they mean, or add references that look {w.word}.</span>}
                {w.verdict === "missing" && <span>doesn’t show in these references. Check with your client before you share.</span>}
                {w.verdict === "checking" && <span className="muted">not one of AxiA’s tags, so the AI is checking each reference for it…</span>}
                {w.verdict === "unchecked" && <span className="muted">not one of AxiA’s tags, and the AI couldn’t check it ({w.error}). Add an API key in Library → Analyser settings.</span>}
                {w.verdict === "unknown" && <span className="muted">AxiA will check this word once there are references.</span>}
                {w.checking && w.verdict !== "checking" && <span className="muted"> · the AI is also checking each reference…</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// A list of spec points. Notes stay folded until you ask for one (or one exists).
function SpecList({ title, hint, items, refs, votes, sharedKeys, fileToRef, setEdit, openNotes, setOpenNotes, onRemovePoint }) {
  if (!items.length) return null;
  return (
    <div className="spec-group">
      {title && <h3>{title} <span className="muted">{hint}</span></h3>}
      <ul>
        {items.map((it) => {
          const v = votes[it.key];
          const showNote = openNotes[it.key] || it.note;
          return (
            <li key={it.key} className={`spec-item${it.off ? " off" : ""}`}>
              <div className="spec-line">
                <label className="spec-toggle">
                  <input type="checkbox" checked={!it.off} onChange={(e) => setEdit(it.key, { off: !e.target.checked })} aria-label={`Keep ${it.tag} in the spec`} />
                  <span className="spec-text">
                    <span className="spec-cat">{it.category}</span>
                    <span><span className="spec-tag">{it.tag}</span>{it.meaning && <span className="spec-meaning"> {it.meaning}</span>}</span>
                  </span>
                </label>
                {it.custom ? (
                  <button className="btn small" onClick={() => onRemovePoint(it.key)}>Remove</button>
                ) : (
                  <span className="spec-evidence" title={`${it.count} of ${refs.length} references are tagged ${it.tag}`}>
                    <span className="thumbs">
                      {it.examples.map((f) => { const r = fileToRef.get(f); return r ? <img key={f} src={r.thumb} alt="" loading="lazy" /> : null; })}
                    </span>
                    <span className="count">{it.count}/{refs.length}</span>
                  </span>
                )}
              </div>
              {!it.off && (showNote
                ? <input className="note" value={it.note} autoFocus={!it.note} onChange={(e) => setEdit(it.key, { note: e.target.value })} placeholder="Note for your client, in your words" />
                : <button className="btn small add-note" onClick={() => setOpenNotes({ ...openNotes, [it.key]: true })}>+ Note for client</button>)}
              {v && sharedKeys.has(it.key) && (
                <p className={`vote ${v.vote ?? ""}`}>
                  {v.vote && <b>{VOTES[v.vote].mark} {VOTES[v.vote].label}</b>}
                  {v.comment && <span>“{v.comment}”</span>}
                  <span className="muted">{v.name || "Client"}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
