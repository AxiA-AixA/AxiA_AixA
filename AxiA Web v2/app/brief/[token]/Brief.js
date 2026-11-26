"use client";

import { useEffect, useState } from "react";
import { imgUrl } from "@/lib/axia";
import { VOTES } from "@/lib/spec";
import { AxiaLogotype, AxiaSymbol } from "../../Brand";

// The client's page: the shared spec, one point at a time. No sign-up. They agree, say they're
// not sure, or disagree, with an optional comment, then send. They can change answers and send again.
export default function Brief({ token }) {
  const [b, setB] = useState(null);
  const [missing, setMissing] = useState(false);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const draftKey = `axia-brief-${token}`;

  useEffect(() => {
    fetch(`/api/brief/${token}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setB).catch(() => setMissing(true));
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (d) { setAnswers(d.answers ?? {}); setName(d.name ?? ""); }
    } catch {}
  }, [token]);

  function set(key, change) {
    const next = { ...answers, [key]: { ...answers[key], ...change } };
    setAnswers(next);
    if (state === "sent") setState("idle");
    try { localStorage.setItem(draftKey, JSON.stringify({ answers: next, name })); } catch {}
  }

  async function send(e) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`/api/brief/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, items: answers }) });
      setState(res.ok ? "sent" : "error");
      try { localStorage.setItem(draftKey, JSON.stringify({ answers, name })); } catch {}
    } catch { setState("error"); }
  }

  if (missing) return <section className="brief"><h1>This brief isn’t available</h1><p className="muted">The link may be wrong, or the designer has removed the project. Ask them for a new link.</p></section>;
  if (!b) return <section className="brief"><p className="muted">Loading…</p></section>;

  const answered = b.items.filter((i) => answers[i.key]?.vote).length;

  return (
    <section className="brief">
      <header className="brief-head">
        <div className="lockup" role="img" aria-label="AxiA"><AxiaSymbol height={14} /><AxiaLogotype height={13} /></div>
        <p className="eyebrow">Visual brief{b.client ? ` for ${b.client}` : ""}</p>
        <h1>{b.word ? <>What “{b.word}” means for {b.name}</> : <>The look of {b.name}</>}</h1>
        <p className="muted">Your designer read these points from the references they collected. Tell them, point by point, whether this is the look you mean. It takes about two minutes.</p>
        <div className="brief-progress" role="progressbar" aria-valuemin={0} aria-valuemax={b.items.length} aria-valuenow={answered} aria-label="Answered">
          <span style={{ width: `${(answered / b.items.length) * 100}%` }} />
        </div>
      </header>

      <form onSubmit={send}>
        <ol className="brief-items">
          {b.items.map((it, n) => {
            const a = answers[it.key] ?? {};
            return (
              <li key={it.key} className="brief-item glass">
                <div className="brief-text">
                  <span className="brief-no">{n + 1}</span>
                  <div>
                    <p className="eyebrow">{it.category}</p>
                    <h2>{it.tag}</h2>
                    {it.meaning && <p>{it.meaning}</p>}
                    {it.note && <p className="designer-note">Designer’s note: {it.note}</p>}
                    {it.count > 0 && <p className="muted">Seen in {it.count} of the references</p>}
                  </div>
                </div>
                {it.examples.length > 0 && (
                  <div className="brief-thumbs">
                    {it.examples.map((f) => <img key={f} src={imgUrl(f, { thumb: true })} alt="" loading="lazy" />)}
                  </div>
                )}
                <div className="votes segmented" role="group" aria-label={`Your answer for ${it.tag}`}>
                  {Object.entries(VOTES).map(([k, v]) => (
                    <button type="button" key={k} aria-pressed={a.vote === k} className={k} onClick={() => set(it.key, { vote: a.vote === k ? null : k })}>
                      {v.mark} {v.label}
                    </button>
                  ))}
                </div>
                <input className="note" value={a.comment ?? ""} onChange={(e) => set(it.key, { comment: e.target.value })} placeholder="Comment (optional)" />
              </li>
            );
          })}
        </ol>

        <div className="brief-send glass">
          <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="So your designer knows who answered" /></label>
          <button className="btn primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send answers"}</button>
          <p className="muted" role="status">
            {state === "sent" ? "Sent. Your designer turns your answers into the agreed brief for this project. Change anything and send again if you need to."
              : state === "error" ? "That didn’t go through. Check your connection and try again."
              : `${answered} of ${b.items.length} answered`}
          </p>
        </div>
      </form>
    </section>
  );
}
