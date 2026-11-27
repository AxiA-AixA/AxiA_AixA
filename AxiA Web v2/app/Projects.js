"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cardStage, plural } from "@/lib/status";
import PageHeader from "./shell/PageHeader";
import { PlusIcon } from "./shell/icons";

// Home: the designer's projects. Each one turns its references into a visual spec for one client.
export default function Projects() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [lib, setLib] = useState({ online: true, byId: new Map() });
  const [form, setForm] = useState({ name: "", client: "", word: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setList).catch(() => setList([]));
    fetch("/api/library").then((r) => r.json())
      .then((d) => setLib({ online: d.online, byId: new Map(d.items.map((i) => [i.id, i])) }))
      .catch(() => setLib({ online: false, byId: new Map() }));
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Give the project a name."); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const p = await res.json();
    if (!res.ok) { setError(p.error ?? "Couldn't create the project."); setBusy(false); return; }
    router.push(`/project/${p.id}`);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="projects">
      <PageHeader title="Projects" sub="Each project turns your references into one visual spec you and your client agree on.">
        <button className="btn primary" onClick={() => setCreating(true)}><PlusIcon />New project</button>
      </PageHeader>

      {!lib.online && (
        <p className="notice glass">The AI analyser (axia-prototype) is off, so references and images can’t load. Open <code>Axia-실행-Mac.command</code> (Windows: <code>Axia-실행-Windows.bat</code>) in the axia-prototype folder, then refresh.</p>
      )}

      {creating && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="New project" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form className="sheet new-project-form" onSubmit={create} onKeyDown={(e) => e.key === "Escape" && setCreating(false)}>
            <div className="sheet-head"><h2>New project</h2><button type="button" className="btn icon" onClick={() => setCreating(false)} aria-label="Close">✕</button></div>
            <div className="fields">
              <label>Project<input value={form.name} onChange={set("name")} placeholder="Spring campaign" autoFocus /></label>
              <label>Client<input value={form.client} onChange={set("client")} placeholder="Studio or brand name" /></label>
              <label>Client’s words for the look<input value={form.word} onChange={set("word")} placeholder="e.g. minimal, premium, romantic" /></label>
            </div>
            <div className="row">
              <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
              {error && <span className="error">{error}</span>}
            </div>
          </form>
        </div>
      )}

      {list === null ? <p className="muted">Loading…</p> : (
        <ul className="project-grid">
          <li><button className="new-card" onClick={() => setCreating(true)}><PlusIcon />New project</button></li>
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/project/${p.id}`} className="project-card glass">
                <div className="cover">
                  {[0, 1, 2, 3].map((i) => {
                    const ref = lib.byId.get(p.cover[i]);
                    return ref ? <img key={i} src={ref.thumb} alt="" loading="lazy" /> : <span key={i} />;
                  })}
                </div>
                <div className="card-text">
                  <h2>{p.name}</h2>
                  <p>{[p.client, p.word && `“${p.word}”`].filter(Boolean).join(" · ") || "No client yet"}</p>
                  {(() => {
                    const s = cardStage(p);
                    return (
                      <div className="card-stage">
                        <span className="dots" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < s.step ? "done" : i === s.step ? "now" : ""} />)}</span>
                        <span><b>{s.next}</b> · {plural(p.refs, "reference")}</span>
                      </div>
                    );
                  })()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
