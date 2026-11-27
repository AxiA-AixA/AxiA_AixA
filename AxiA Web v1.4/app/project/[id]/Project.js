"use client";

// One project, as four steps: references → spec → client → agreed brief.
// The header always shows where you are and the one thing to do next.
//   useProject.js        loading and saving the project, the library
//   useAddReferences.js  files, links, paste and drop
//   RefsPanel / SpecPanel / ClientPanel   the three columns
//   lib/status.js        the steps and the next action (pure)

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildSpec, checkWords, clientWords, latestVotes, summarise } from "@/lib/spec";
import { changedSinceShare, nextAction, projectSteps, tallyVotes } from "@/lib/status";
import { usePolling, useProject } from "./useProject";
import { useAddReferences } from "../../shared/useAddReferences";
import RefsPanel, { isAnalysing } from "./RefsPanel";
import SpecPanel from "./SpecPanel";
import ClientPanel from "./ClientPanel";
import Picker from "./Picker";

const TOAST_MS = 6000;
const ANALYSING_POLL_MS = 2000; // while images are analysed, the spec fills in as tags arrive

export default function Project({ id }) {
  const router = useRouter();
  const { project: p, missing, lib, save, flush, setProject, reloadLib } = useProject(id);
  const linkInput = useRef(null);
  const [link, setLink] = useState("");
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState(null); // { text, undo? }
  const toastTimer = useRef(null);
  const latest = useRef(p); // the project as it is now, for Undo after later edits
  latest.current = p;
  const [shareMsg, setShareMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const adder = useAddReferences(`/api/projects/${id}/add`, {
    onResult: (d) => d.refs && setProject((cur) => ({ ...cur, refs: d.refs })), before: flush, after: reloadLib, linkInput,
  });

  // ---------- derived ----------
  const byId = useMemo(() => new Map(lib.items.map((i) => [i.id, i])), [lib]);
  const allRefs = useMemo(() => (p ? p.refs.map((r) => byId.get(r)).filter(Boolean) : []), [p, byId]);
  const refs = useMemo(() => allRefs.filter((r) => r.status === "tagged"), [allRefs]); // the spec reads analysed images only
  const busy = allRefs.filter(isAnalysing).length;
  // The client's own words (not fixed tags) are checked by the AI on each reference; wait for the answers.
  const wordsPending = clientWords(p?.word).some((w) => refs.some((r) => !(w in r.words) && !r.wordsError));
  usePolling(reloadLib, ANALYSING_POLL_MS, busy > 0 || adder.uploading > 0 || wordsPending);

  const spec = useMemo(() => (p ? buildSpec(refs, p.edits, p.custom, p.word) : []), [p, refs]);
  const votes = useMemo(() => latestVotes(p?.responses), [p]);
  const fileToRef = useMemo(() => new Map(allRefs.map((r) => [r.file, r])), [allRefs]);
  const words = useMemo(() => (p?.word && refs.length >= 3 ? checkWords(p.word, refs) : []), [p?.word, refs]);

  if (missing) return <section className="lab"><h1>Project not found</h1><p><Link href="/">Back to projects</Link></p></section>;
  if (!p) return <p className="muted">Loading…</p>;

  const kept = spec.filter((i) => !i.off);
  const sharedKeys = new Set(p.shared?.items.map((i) => i.key) ?? []);
  const changed = changedSinceShare(p.shared, kept);
  const tally = tallyVotes(sharedKeys, votes);
  const state = { online: lib.online, refs: allRefs.length, busy, kept: kept.length, shared: p.shared, changed, tally };
  const { steps, current } = projectSteps(state);
  const next = nextAction(state);
  const briefLink = p.shared ? `${location.origin}/brief/${p.shared.token}` : "";

  // ---------- actions ----------
  function showToast(t) {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }
  const setEdit = (key, change) => save({ edits: { ...p.edits, [key]: { ...p.edits[key], ...change } } });
  function removeRef(rid) {
    const at = p.refs.indexOf(rid);
    save({ refs: p.refs.filter((r) => r !== rid) });
    showToast({
      text: "Reference removed from this project",
      undo: () => {
        const cur = latest.current.refs;
        if (!cur.includes(rid)) save({ refs: [...cur.slice(0, at), rid, ...cur.slice(at)] });
      },
    });
  }
  const toggleRef = (rid) => (p.refs.includes(rid) ? removeRef(rid) : save({ refs: [...p.refs, rid] }));
  async function retry(rid) {
    await fetch("/api/retag", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [rid] }) });
    await reloadLib();
  }
  const addPoint = (text) => save({ custom: [...p.custom, { key: `custom-${Date.now().toString(36)}`, text }] });
  const removePoint = (key) => save({ custom: p.custom.filter((c) => c.key !== key) });

  async function share() {
    setShareMsg("Sharing…");
    await flush(); // the brief must match the screen
    const res = await fetch(`/api/projects/${id}/share`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) { setShareMsg(d.error ?? "Couldn't share."); return; }
    const again = !!p.shared;
    setProject(d);
    setShareMsg(again ? "Updated. Your client sees the new version at the same link." : "");
    if (!again) document.getElementById("step-client")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function copy() {
    navigator.clipboard?.writeText(briefLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  async function remove() {
    if (!confirm(`Delete “${p.name}”? Its spec and your client's answers are deleted too. References stay in your library.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  }
  const actions = {
    addRefs: () => linkInput.current?.focus(),
    share,
    copy,
    agreed: () => router.push(`/project/${id}/agreed`),
  };

  return (
    <section className="project">
      <header className="project-head">
        <Link href="/" className="back">← Projects</Link>
        <div className="title-row">
          <input className="title-input" value={p.name} onChange={(e) => save({ name: e.target.value })} aria-label="Project name" />
          <button className="btn primary next-action" onClick={actions[next.action]} disabled={next.disabled}>
            {next.action === "copy" && copied ? "Link copied" : next.text}
          </button>
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
        <RefsPanel refs={allRefs} online={lib.online} adder={adder} link={link} setLink={setLink} linkInput={linkInput}
          onPick={() => setPicking(true)} onRemove={removeRef} onRetry={retry} />
        <div className="spec-col">
          <SpecPanel project={p} spec={spec} refs={refs} busy={busy} words={words} summary={summarise(spec)}
            votes={votes} sharedKeys={sharedKeys} fileToRef={fileToRef} setEdit={setEdit} onAddPoint={addPoint} onRemovePoint={removePoint} />
          <ClientPanel id={id} shared={p.shared} link={briefLink} kept={kept.length} tally={tally} changed={changed} copied={copied}
            canShare={kept.length > 0 && lib.online && !busy} busy={busy} message={shareMsg} onShare={share} onCopy={copy} />
        </div>
      </div>

      {adder.dragging && <div className="drop-overlay" aria-hidden="true"><p>Drop to add to {p.name}</p></div>}
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
