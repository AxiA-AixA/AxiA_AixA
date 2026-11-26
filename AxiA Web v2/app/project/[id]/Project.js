"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildSpec, checkWords, latestVotes, strength, summarise, VOTES, SHARE } from "@/lib/spec";
import Picker from "./Picker";

const ENOUGH = 5; // references before the spec means much
const analysing = (r) => r.status === "queued" || r.status === "retry";

// One project, as four steps: references → spec → client → agreed brief.
// The header always shows where you are and the one thing to do next.
export default function Project({ id }) {
  const router = useRouter();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const [lib, setLib] = useState({ online: true, items: [] });
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [addError, setAddError] = useState("");
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState(null); // { text, undo? }
  const [newPoint, setNewPoint] = useState("");
  const [openNotes, setOpenNotes] = useState({});
  const [shareMsg, setShareMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const pending = useRef({});
  const fileInput = useRef(null);
  const linkInput = useRef(null);

  const loadLib = useCallback(() => fetch("/api/library").then((r) => r.json()).then(setLib).catch(() => setLib({ online: false, items: [] })), []);
  useEffect(() => {
    fetch(`/api/projects/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setP).catch(() => setMissing(true));
    loadLib();
  }, [id, loadLib]);

  const byId = useMemo(() => new Map(lib.items.map((i) => [i.id, i])), [lib]);
  const allRefs = useMemo(() => (p ? p.refs.map((r) => byId.get(r)).filter(Boolean) : []), [p, byId]);
  const busy = allRefs.filter(analysing).length;
  const unread = allRefs.filter((r) => r.status === "failed" || r.status === "new").length;

  // While images are being analysed, refresh every 2 s so the spec fills in as tags arrive.
  // Once shared, refresh the client's answers every 10 s.
  useEffect(() => {
    if (!busy && !uploading) return;
    const t = setInterval(loadLib, 2000);
    return () => clearInterval(t);
  }, [busy, uploading, loadLib]);
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
    timer.current = setTimeout(flush, 400);
  }
  async function flush() {
    clearTimeout(timer.current);
    const body = pending.current;
    pending.current = {};
    if (Object.keys(body).length) await fetch(`/api/projects/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  function showToast(t) {
    setToast(t);
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => setToast(null), 6000);
  }

  // ---------- adding references: files, pasted screenshots, links, the library ----------
  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) { setAddError("Only image files can be added (JPG, PNG, WebP, GIF)."); return; }
    setAddError("");
    await flush();
    setUploading((n) => n + images.length);
    const errors = [];
    for (const f of images) {
      try {
        const res = await fetch(`/api/projects/${id}/add?name=${encodeURIComponent(f.name || "pasted image")}`, { method: "POST", headers: { "content-type": f.type }, body: f });
        const d = await res.json();
        if (d.refs) setP((cur) => ({ ...cur, refs: d.refs }));
        errors.push(...(d.errors ?? []).map((e) => e.error), ...(d.error ? [d.error] : []));
      } catch { errors.push("Upload failed. Check that AxiA is still running."); }
      setUploading((n) => n - 1);
    }
    await loadLib();
    if (errors.length) setAddError(errors[0]);
  }
  async function addLinks(text) {
    const urls = [...new Set(text.match(/https?:\/\/[^\s"'<>]+/g) ?? [])];
    if (!urls.length) { setAddError("Paste a link that starts with http."); return; }
    setAddError("");
    await flush();
    setUploading((n) => n + urls.length);
    try {
      const res = await fetch(`/api/projects/${id}/add`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls }) });
      const d = await res.json();
      if (d.refs) setP((cur) => ({ ...cur, refs: d.refs }));
      const err = d.error ?? d.errors?.[0]?.error;
      if (err) setAddError(d.errors?.length > 1 ? `${d.errors.length} links didn't work. ${err}` : err);
      else setLink("");
    } catch { setAddError("Couldn't add the link. Check that AxiA is still running."); }
    setUploading((n) => n - urls.length);
    await loadLib();
  }

  // ⌘V anywhere on the page: images go in as files; links go in when you're not typing in a field.
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) { e.preventDefault(); addFiles(files); return; }
      const inField = /INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? "") && document.activeElement !== linkInput.current;
      const text = e.clipboardData?.getData("text") ?? "";
      if (!inField && /https?:\/\//.test(text)) { e.preventDefault(); addLinks(text); }
    };
    const onOver = (e) => { if ([...(e.dataTransfer?.types ?? [])].some((t) => t === "Files" || t === "text/uri-list")) { e.preventDefault(); setDragging(true); } };
    const onLeave = (e) => { if (!e.relatedTarget) setDragging(false); };
    const onDrop = (e) => {
      e.preventDefault(); setDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      else { const u = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text"); if (u) addLinks(u); }
    };
    addEventListener("paste", onPaste); addEventListener("dragover", onOver); addEventListener("dragleave", onLeave); addEventListener("drop", onDrop);
    return () => { removeEventListener("paste", onPaste); removeEventListener("dragover", onOver); removeEventListener("dragleave", onLeave); removeEventListener("drop", onDrop); };
  });

  const refs = allRefs.filter((r) => r.status === "tagged"); // the spec reads analysed images only
  const spec = useMemo(() => (p ? buildSpec(refs, p.edits, p.custom) : []), [p, refs]);
  const votes = useMemo(() => latestVotes(p?.responses), [p]);
  const fileToRef = useMemo(() => new Map(allRefs.map((r) => [r.file, r])), [allRefs]);
  const words = useMemo(() => (p?.word && refs.length >= 3 ? checkWords(p.word, refs) : []), [p?.word, refs]);

  if (missing) return <section className="lab"><h1>Project not found</h1><p><Link href="/">Back to projects</Link></p></section>;
  if (!p) return <p className="muted">Loading…</p>;

  const setEdit = (key, change) => save({ edits: { ...p.edits, [key]: { ...p.edits[key], ...change } } });
  function removeRef(rid) {
    const at = p.refs.indexOf(rid);
    save({ refs: p.refs.filter((r) => r !== rid) });
    showToast({ text: "Reference removed from this project", undo: () => save({ refs: [...p.refs.slice(0, at), rid, ...p.refs.slice(at)].filter((v, i, a) => a.indexOf(v) === i) }) });
  }
  async function retry(rid) {
    await fetch("/api/retag", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [rid] }) });
    await loadLib();
  }
  const toggleRef = (rid) => (p.refs.includes(rid) ? removeRef(rid) : save({ refs: [...p.refs, rid] }));
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
    await flush(); // the brief must match the screen
    const res = await fetch(`/api/projects/${id}/share`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) { setShareMsg(d.error ?? "Couldn't share."); return; }
    const again = !!p.shared;
    setP(d);
    setShareMsg(again ? "Updated. Your client sees the new version at the same link." : "");
    if (!again) document.getElementById("step-client")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const briefLink = p.shared ? `${location.origin}/brief/${p.shared.token}` : "";
  function copy() {
    navigator.clipboard?.writeText(briefLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  async function remove() {
    if (!confirm(`Delete “${p.name}”? Its spec and your client's answers are deleted too. References stay in your library.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  }

  // ---------- where the project stands ----------
  const kept = spec.filter((i) => !i.off);
  const clear = spec.filter((i) => strength(i) === "clear");
  const some = spec.filter((i) => strength(i) === "some");
  const sharedKeys = new Set(p.shared?.items.map((i) => i.key) ?? []);
  const changedSinceShare = p.shared && (kept.length !== sharedKeys.size || kept.some((i) => !sharedKeys.has(i.key)));
  const tally = { agree: 0, unsure: 0, disagree: 0 };
  for (const k of sharedKeys) if (votes[k]?.vote) tally[votes[k].vote]++;
  const answered = tally.agree + tally.unsure + tally.disagree;
  const tagCount = refs.reduce((n, r) => n + r.tags.length, 0);
  const summary = summarise(spec);

  const steps = [
    { key: "refs", label: "References", detail: `${allRefs.length}${busy ? ` · ${busy} analysing` : ""}`, done: allRefs.length >= ENOUGH && !busy },
    { key: "spec", label: "Spec", detail: `${kept.length} point${kept.length === 1 ? "" : "s"}`, done: kept.length >= 3 && !!p.shared && !changedSinceShare },
    { key: "client", label: "Client", detail: p.shared ? `${answered}/${sharedKeys.size} answered` : "not shared", done: !!p.shared && answered === sharedKeys.size },
    { key: "agreed", label: "Agreed brief", detail: p.shared ? `${tally.agree}/${sharedKeys.size} agreed` : "after sharing", done: !!p.shared && tally.agree === sharedKeys.size },
  ];
  const current = steps.findIndex((s) => !s.done);
  const next = !lib.online ? { text: "Start the AI analyser to continue", disabled: true }
    : allRefs.length < ENOUGH ? { text: allRefs.length ? `Add ${ENOUGH - allRefs.length} more reference${ENOUGH - allRefs.length === 1 ? "" : "s"}` : "Add references", go: () => linkInput.current?.focus() }
    : busy ? { text: `Analysing ${busy} reference${busy === 1 ? "" : "s"}…`, disabled: true }
    : !p.shared ? { text: "Share with client", go: share, disabled: !kept.length }
    : changedSinceShare ? { text: "Update shared brief", go: share }
    : !answered ? { text: copied ? "Link copied" : "Copy client link", go: copy }
    : { text: "Open agreed brief", go: () => router.push(`/project/${id}/agreed`) };

  return (
    <section className="project">
      <header className="project-head">
        <Link href="/" className="back">← Projects</Link>
        <div className="title-row">
          <input className="title-input" value={p.name} onChange={(e) => save({ name: e.target.value })} aria-label="Project name" />
          <button className="btn primary next-action" onClick={next.go} disabled={next.disabled}>{next.text}</button>
        </div>
        <div className="meta-inputs">
          <label>Client<input value={p.client} onChange={(e) => save({ client: e.target.value })} placeholder="Studio or brand" /></label>
          <label>Client’s words for the look<input value={p.word} onChange={(e) => save({ word: e.target.value })} placeholder="e.g. minimal, premium" /></label>
          <button className="btn" onClick={remove}>Delete project</button>
        </div>
        <ol className="stepper" aria-label="Project progress">
          {steps.map((s, i) => (
            <li key={s.key} className={s.done ? "done" : i === current ? "current" : ""} aria-current={i === current ? "step" : undefined}>
              <a href={s.key === "agreed" ? (p.shared ? `/project/${id}/agreed` : undefined) : `#step-${s.key}`}>
                <span className="step-dot" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
                <span><b>{s.label}</b><small>{s.detail}</small></span>
              </a>
            </li>
          ))}
        </ol>
      </header>

      {!lib.online && <p className="notice glass">The AI analyser (axia-prototype) is off, so references can’t load or be analysed. Open <code>Axia-실행-Mac.command</code> in the axia-prototype folder, then refresh.</p>}

      <div className="project-cols">
        {/* ---------- 1. References ---------- */}
        <div className="refs-col" id="step-refs">
          <div className="col-head">
            <h2>References <span className="muted">{allRefs.length}</span></h2>
            <span className="muted">{allRefs.length < ENOUGH ? `${ENOUGH}–20 work best` : busy ? `${busy} being analysed` : unread ? `${unread} not analysed` : "All analysed"}</span>
          </div>

          <div className="add-bar glass">
            <form onSubmit={(e) => { e.preventDefault(); addLinks(link); }}>
              <input ref={linkInput} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Pinterest, Instagram or image link" aria-label="Reference link" />
              <button className="btn primary" disabled={!link.trim() || !lib.online}>Add</button>
            </form>
            <div className="add-ways">
              <button className="btn" onClick={() => fileInput.current?.click()} disabled={!lib.online}>Upload images</button>
              <button className="btn" onClick={() => setPicking(true)} disabled={!lib.online}>From library</button>
              <span className="muted">or drop images here · ⌘V a screenshot</span>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {addError && <p className="error" role="alert">{addError}</p>}
          </div>

          {allRefs.length === 0 && !uploading ? (
            <div className="drop-empty">
              <p><b>Start with what your client showed you.</b></p>
              <p className="muted">Drop the images from their brief, paste links to their Pinterest pins, or pick from what you’ve saved. AxiA reads each image with the same fixed tags, then writes the spec.</p>
            </div>
          ) : (
            <ul className="ref-grid">
              {allRefs.map((r) => (
                <li key={r.id} className={analysing(r) ? "analysing" : r.status === "failed" ? "failed" : ""} title={r.tags.join(" · ")}>
                  <img src={r.image} alt={r.title || ""} loading="lazy" />
                  {analysing(r) && <span className="ref-state">Analysing…</span>}
                  {(r.status === "failed" || r.status === "new") && (
                    <button className="ref-state retry" onClick={() => retry(r.id)} title={r.error ?? "Not analysed yet"}>{r.status === "failed" ? "Couldn’t analyse · Retry" : "Analyse"}</button>
                  )}
                  <button className="ref-x" onClick={() => removeRef(r.id)} aria-label="Remove from project">×</button>
                </li>
              ))}
              {Array.from({ length: uploading }, (_, i) => <li key={`up-${i}`} className="uploading"><span className="ref-state">Adding…</span></li>)}
            </ul>
          )}
        </div>

        <div className="spec-col">
          {/* ---------- 2. Spec ---------- */}
          <div className="spec glass" id="step-spec">
            <p className="eyebrow">Visual spec</p>
            <h2 className="spec-title">{p.word ? <>What “{p.word}” means for {p.name}</> : <>The look of {p.name}</>}</h2>

            {refs.length < 3 ? (
              <p className="muted">Add at least {ENOUGH} references. AxiA tags each one, then lists what most of them share. {busy > 0 && `${busy} still being analysed.`}</p>
            ) : (
              <>
                {summary && <p className="spec-summary">These references point to {summary}.</p>}
                <details className="method">
                  <summary>Read from {refs.length} references · {tagCount} AI tags{busy ? ` · ${busy} still analysing` : ""}</summary>
                  <p>Each image gets tags from one fixed list (form, material, light, colour, type, mood). A tag becomes a point here when at least {Math.round(SHARE * 100)}% of the references have it. Nothing is invented: every point shows how many references it came from. Turn off what doesn’t belong and add notes in your own words before you share.</p>
                </details>

                {words.length > 0 && (
                  <div className="word-check">
                    <h3>Your client said</h3>
                    <ul>
                      {words.map((w) => (
                        <li key={w.word} className={w.verdict}>
                          <b>“{w.word}”</b>
                          {w.verdict === "shows" && <span>shows in the references: {w.tags.filter((t) => t.share >= SHARE).map((t) => `${t.tag} ${Math.round(t.share * 100)}%`).join(", ")}</span>}
                          {w.verdict === "faint" && <span>only faintly: {w.tags[0].tag} in {Math.round(w.tags[0].share * 100)}%. Ask what they mean, or add references that look {w.word}.</span>}
                          {w.verdict === "missing" && <span>doesn’t show in these references. Check with your client before you share.</span>}
                          {w.verdict === "unknown" && <span className="muted">AxiA doesn’t know this word yet. The points below come from the references only.</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <SpecList title="Clear" hint="in 60%+ of references, or added by you" items={clear} {...{ refs, votes, sharedKeys, fileToRef, setEdit, openNotes, setOpenNotes, removePoint }} />
                {some.length > 0 && (
                  <details className="some-points">
                    <summary>{some.length} weaker point{some.length === 1 ? "" : "s"} (30–59% of references) · {some.filter((i) => !i.off).length ? `${some.filter((i) => !i.off).length} switched on` : "off unless you switch them on"}</summary>
                    <SpecList items={some} {...{ refs, votes, sharedKeys, fileToRef, setEdit, openNotes, setOpenNotes, removePoint }} />
                  </details>
                )}
                <form className="add-point" onSubmit={addPoint}>
                  <input value={newPoint} onChange={(e) => setNewPoint(e.target.value)} placeholder="Add a point in your own words, e.g. “No neon, no gradients”" />
                  <button className="btn" disabled={!newPoint.trim()}>Add</button>
                </form>
              </>
            )}
          </div>

          {/* ---------- 3. Client ---------- */}
          <div className="share glass" id="step-client">
            <h2>Client</h2>
            {p.shared ? (
              <>
                <p className="muted">Your client opens this link, sees each point with its example images and answers Agree, Not sure or Disagree. No account needed.</p>
                <div className="link-row">
                  <input readOnly value={briefLink} onFocus={(e) => e.target.select()} aria-label="Client link" />
                  <button className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
                  <a className="btn" href={briefLink} target="_blank" rel="noopener noreferrer">Preview</a>
                </div>
                <div className="tally-bar" aria-label={`${tally.agree} agreed, ${tally.unsure} not sure, ${tally.disagree} disagreed, ${sharedKeys.size - answered} unanswered`}>
                  {["agree", "unsure", "disagree"].map((k) => <span key={k} className={k} style={{ flex: tally[k] }} />)}
                  <span className="none" style={{ flex: sharedKeys.size - answered }} />
                </div>
                <p className="tally"><b>{tally.agree}</b> agreed · <b>{tally.unsure}</b> not sure · <b>{tally.disagree}</b> disagreed · {sharedKeys.size - answered} waiting</p>
                {changedSinceShare && <p className="warn">You’ve changed the spec since sharing. Update the brief so your client sees the same points.</p>}
                <div className="row">
                  <button className="btn" onClick={share}>{changedSinceShare ? "Update shared brief" : "Re-share current spec"}</button>
                  {/* ---------- 4. Agreed brief ---------- */}
                  <Link className="btn primary" href={`/project/${id}/agreed`}>Open agreed brief</Link>
                </div>
              </>
            ) : (
              <>
                <p className="muted">{kept.length ? `Share the ${kept.length} point${kept.length === 1 ? "" : "s"} you kept as a link.` : "When the spec has points, share it as a link."} Your client answers each one, and you get an <b>agreed brief</b>: one page with the agreed look, the open questions and their sign-off, ready to attach to your proposal.</p>
                <button className="btn primary" onClick={share} disabled={!kept.length || !lib.online || busy > 0}>{busy ? "Wait for analysis to finish" : "Share with client"}</button>
              </>
            )}
            {shareMsg && <p className="muted" role="status">{shareMsg}</p>}
          </div>
        </div>
      </div>

      {dragging && <div className="drop-overlay" aria-hidden="true"><p>Drop to add to {p.name}</p></div>}
      {toast && (
        <div className="toast glass" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button className="btn" onClick={() => { toast.undo(); setToast(null); }}>Undo</button>}
        </div>
      )}
      {picking && <Picker items={lib.items} chosen={p.refs} projectRefs={refs} onToggle={toggleRef} onClose={() => setPicking(false)} />}
    </section>
  );
}

// A list of spec points. Notes stay folded until you ask for one (or one exists).
function SpecList({ title, hint, items, refs, votes, sharedKeys, fileToRef, setEdit, openNotes, setOpenNotes, removePoint }) {
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
                {!it.custom ? (
                  <span className="spec-evidence" title={`${it.count} of ${refs.length} references are tagged ${it.tag}`}>
                    <span className="thumbs">
                      {it.examples.map((f) => { const r = fileToRef.get(f); return r ? <img key={f} src={r.image} alt="" loading="lazy" /> : null; })}
                    </span>
                    <span className="count">{it.count}/{refs.length}</span>
                  </span>
                ) : (
                  <button className="btn small" onClick={() => removePoint(it.key)}>Remove</button>
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
