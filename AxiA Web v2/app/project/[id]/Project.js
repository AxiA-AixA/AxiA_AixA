"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildSpec, latestVotes, VOTES, SHARE } from "@/lib/spec";
import Picker from "./Picker";

// One project: its references (left) and the visual spec read from their tags (right).
// The designer turns points off, adds notes or points of their own, then shares the spec as a brief.
export default function Project({ id }) {
  const router = useRouter();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const [lib, setLib] = useState({ online: true, items: [] });
  const [picking, setPicking] = useState(false);
  const [newPoint, setNewPoint] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const pending = useRef({});

  useEffect(() => {
    fetch(`/api/projects/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setP).catch(() => setMissing(true));
    fetch("/api/library").then((r) => r.json()).then(setLib).catch(() => setLib({ online: false, items: [] }));
  }, [id]);

  // Client answers arrive while the page is open: refresh them every 10 s.
  useEffect(() => {
    if (!p?.shared) return;
    const t = setInterval(() => {
      fetch(`/api/projects/${id}`).then((r) => r.json()).then((d) => setP((cur) => ({ ...cur, responses: d.responses, shared: d.shared }))).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [id, !!p?.shared]);

  // Change locally at once, save shortly after (typing in a note doesn't send every key).
  function save(patch) {
    setP((cur) => ({ ...cur, ...patch }));
    Object.assign(pending.current, patch);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = pending.current;
      pending.current = {};
      fetch(`/api/projects/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    }, 400);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const byId = useMemo(() => new Map(lib.items.map((i) => [i.id, i])), [lib]);
  const refs = useMemo(() => (p ? p.refs.map((r) => byId.get(r)).filter(Boolean) : []), [p, byId]);
  const spec = useMemo(() => (p ? buildSpec(refs, p.edits, p.custom) : []), [p, refs]);
  const votes = useMemo(() => latestVotes(p?.responses), [p]);
  const fileToRef = useMemo(() => new Map(refs.map((r) => [r.file, r])), [refs]);

  if (missing) return <section className="lab"><h1>Project not found</h1><p><Link href="/">Back to projects</Link></p></section>;
  if (!p) return <p className="muted">Loading…</p>;

  const setEdit = (key, change) => save({ edits: { ...p.edits, [key]: { ...p.edits[key], ...change } } });
  const toggleRef = (rid) => save({ refs: p.refs.includes(rid) ? p.refs.filter((r) => r !== rid) : [...p.refs, rid] });
  function addPoint(e) {
    e.preventDefault();
    const text = newPoint.trim();
    if (!text) return;
    save({ custom: [...p.custom, { key: `custom-${Date.now().toString(36)}`, text }] });
    setNewPoint("");
  }
  const removePoint = (key) => save({ custom: p.custom.filter((c) => c.key !== key) });

  async function share() {
    setShareMsg("Sharing…");
    clearTimeout(timer.current); // save pending edits first, so the brief matches the screen
    if (Object.keys(pending.current).length) {
      await fetch(`/api/projects/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(pending.current) });
      pending.current = {};
    }
    const res = await fetch(`/api/projects/${id}/share`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) { setShareMsg(d.error ?? "Couldn't share."); return; }
    setP(d);
    setShareMsg(p.shared ? "Brief updated. The client sees the new version at the same link." : "");
  }
  const link = p.shared ? `${typeof location === "undefined" ? "" : location.origin}/brief/${p.shared.token}` : "";
  function copy() {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  async function remove() {
    if (!confirm(`Delete “${p.name}”? Its spec and client answers are deleted too.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  }

  const kept = spec.filter((i) => !i.off);
  const sharedKeys = new Set(p.shared?.items.map((i) => i.key) ?? []);
  const changedSinceShare = p.shared && (kept.length !== sharedKeys.size || kept.some((i) => !sharedKeys.has(i.key)));
  const tally = { agree: 0, unsure: 0, disagree: 0 };
  for (const k of sharedKeys) if (votes[k]?.vote) tally[votes[k].vote]++;
  const groups = [];
  for (const it of spec) {
    const g = groups.at(-1);
    if (g && g.name === it.category) g.items.push(it); else groups.push({ name: it.category, items: [it] });
  }

  return (
    <section className="project">
      <header className="project-head">
        <Link href="/" className="back">← Projects</Link>
        <input className="title-input" value={p.name} onChange={(e) => save({ name: e.target.value })} aria-label="Project name" />
        <div className="meta-inputs">
          <label>Client<input value={p.client} onChange={(e) => save({ client: e.target.value })} placeholder="Studio or brand" /></label>
          <label>Client’s word for the look<input value={p.word} onChange={(e) => save({ word: e.target.value })} placeholder="minimal, premium…" /></label>
          <button className="btn" onClick={remove}>Delete project</button>
        </div>
      </header>

      {!lib.online && <p className="notice glass">The AI analyser (axia-prototype) is off, so references can’t load. Start it, then refresh.</p>}

      <div className="project-cols">
        <div className="refs-col">
          <div className="col-head">
            <h2>References <span className="muted">{refs.length}</span></h2>
            <button className="btn primary" onClick={() => setPicking(true)} disabled={!lib.online}>Add references</button>
          </div>
          {refs.length === 0 ? (
            <p className="muted">Pick the references that show the look you and your client have in mind. Five to twenty works best.</p>
          ) : (
            <ul className="ref-grid">
              {refs.map((r) => (
                <li key={r.id}>
                  <img src={r.image} alt={r.title || ""} loading="lazy" />
                  <button className="ref-x" onClick={() => toggleRef(r.id)} aria-label="Remove from project">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="spec-col">
          <div className="spec glass">
            <p className="eyebrow">Visual spec</p>
            <h2 className="spec-title">{p.word ? <>What “{p.word}” means for {p.name}</> : <>The look of {p.name}</>}</h2>
            <p className="muted">
              {refs.length
                ? `Read from the fixed AI tags of ${refs.length} reference${refs.length === 1 ? "" : "s"}: a point shows when at least ${Math.round(SHARE * 100)}% of them share a tag. Turn off what doesn’t belong and add notes in your own words.`
                : "Add references and the spec writes itself from what they have in common."}
            </p>

            {groups.map((g) => (
              <div key={g.name} className="spec-group">
                <h3>{g.name}</h3>
                <ul>
                  {g.items.map((it) => {
                    const v = votes[it.key];
                    return (
                      <li key={it.key} className={`spec-item${it.off ? " off" : ""}`}>
                        <label className="spec-toggle">
                          <input type="checkbox" checked={!it.off} onChange={(e) => setEdit(it.key, { off: !e.target.checked })} />
                          <span className="spec-tag">{it.tag}</span>
                          {it.meaning && <span className="spec-meaning">{it.meaning}</span>}
                        </label>
                        {!it.custom ? (
                          <div className="spec-evidence">
                            <span className="bar" style={{ "--p": `${Math.round(it.share * 100)}%` }} />
                            <span className="muted">{it.count} of {refs.length}</span>
                            <span className="thumbs">
                              {it.examples.map((f) => { const r = fileToRef.get(f); return r ? <img key={f} src={r.image} alt="" loading="lazy" /> : null; })}
                            </span>
                          </div>
                        ) : (
                          <button className="btn small" onClick={() => removePoint(it.key)}>Remove</button>
                        )}
                        <input className="note" value={it.note} onChange={(e) => setEdit(it.key, { note: e.target.value })} placeholder="Note for the client (optional)" />
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
            ))}

            <form className="add-point" onSubmit={addPoint}>
              <input value={newPoint} onChange={(e) => setNewPoint(e.target.value)} placeholder="Add a point of your own, e.g. “No neon, no gradients”" />
              <button className="btn" disabled={!newPoint.trim()}>Add</button>
            </form>
          </div>

          <div className="share glass">
            <h2>Client brief</h2>
            {p.shared ? (
              <>
                <p className="muted">Shared {new Date(p.shared.at).toLocaleString()} · {p.shared.items.length} points. The client answers each point; no sign-up.</p>
                <div className="link-row">
                  <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Brief link" />
                  <button className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
                  <a className="btn" href={link} target="_blank" rel="noopener noreferrer">Open</a>
                </div>
                <p className="tally">
                  <b>{tally.agree}</b> agreed · <b>{tally.unsure}</b> not sure · <b>{tally.disagree}</b> disagreed · {sharedKeys.size - tally.agree - tally.unsure - tally.disagree} unanswered
                </p>
                {changedSinceShare && <p className="muted">The spec has changed since you shared it.</p>}
                <button className="btn" onClick={share}>Update shared brief</button>
              </>
            ) : (
              <>
                <p className="muted">Share the {kept.length} points you kept as a link. Your client agrees, pushes back or comments on each one.</p>
                <button className="btn primary" onClick={share} disabled={!kept.length || !lib.online}>Share with client</button>
              </>
            )}
            {shareMsg && <p className="muted">{shareMsg}</p>}
          </div>
        </div>
      </div>

      {picking && <Picker items={lib.items} chosen={p.refs} onToggle={toggleRef} onClose={() => setPicking(false)} />}
    </section>
  );
}
