"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Home: the designer's projects. Each one turns its references into a visual spec for one client.
export default function Projects() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [lib, setLib] = useState({ online: true, byId: new Map() });
  const [form, setForm] = useState({ name: "", client: "", word: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      <header className="page-head">
        <h1>Projects</h1>
        <p>Each project turns its references into one visual spec. Share it with your client and agree on the look, point by point, before the first draft.</p>
      </header>

      {!lib.online && (
        <p className="notice glass">The AI analyser (axia-prototype) is off, so references and images can’t load. Open <code>Axia-실행-Mac.command</code> (Windows: <code>Axia-실행-Windows.bat</code>) in the axia-prototype folder, then refresh.</p>
      )}

      <form className="new-project glass" onSubmit={create}>
        <h2>New project</h2>
        <div className="fields">
          <label>Project<input value={form.name} onChange={set("name")} placeholder="Spring campaign" autoFocus /></label>
          <label>Client<input value={form.client} onChange={set("client")} placeholder="Studio or brand name" /></label>
          <label>The client’s word for the look<input value={form.word} onChange={set("word")} placeholder="minimal, premium, fresh…" /></label>
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
          {error && <span className="error">{error}</span>}
        </div>
      </form>

      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <p className="muted">No projects yet. Create one above, then pick the references that show the look.</p>
      ) : (
        <ul className="project-grid">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/project/${p.id}`} className="project-card glass">
                <div className="cover">
                  {[0, 1, 2, 3].map((i) => {
                    const ref = lib.byId.get(p.cover[i]);
                    return ref ? <img key={i} src={ref.image} alt="" loading="lazy" /> : <span key={i} />;
                  })}
                </div>
                <div className="card-text">
                  <h2>{p.name}</h2>
                  <p>{[p.client, p.word && `“${p.word}”`].filter(Boolean).join(" · ") || "No client yet"}</p>
                  <p className="status">
                    {p.refs} reference{p.refs === 1 ? "" : "s"} · {p.shared
                      ? <>shared · <b>{p.agreed}/{p.items}</b> agreed{p.open ? ` · ${p.open} open` : ""}</>
                      : "not shared yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
