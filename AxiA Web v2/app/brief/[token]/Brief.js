"use client";

import { useEffect, useState } from "react";
import { imgUrl } from "@/lib/axia";
import { VOTES } from "@/lib/spec";

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
        <svg viewBox="0 0 1000 532.7" height="14" fill="currentColor" aria-label="AxiA" role="img">
          <path d="M1000,19.7V5c0-3.6-3.7-6-7-4.6l-484.8,217.3c-5.2,2.3-11.2,2.3-16.4,0L7,.4C3.7-1,0,1.4,0,5v49.6C0,59.7,2,64.7,5.5,68.4l253.1,265.1c4.4,4.6,3.4,12.1-2,15.4L4.7,504.5C1.8,506.3,0,509.6,0,513v14.7c0,3.6,3.7,6,7,4.6l484.8-217.3c5.2-2.3,11.2-2.3,16.4,0l484.8,217.3c3.3,1.5,7-.9,7-4.6v-49.6c0-5.1-2-10.1-5.5-13.8l-253.1-265.1c-4.4-4.6-3.4-12.1,2-15.4L995.3,28.2c2.9-1.8,4.7-5,4.7-8.5Z" />
        </svg>
        <p className="eyebrow">Visual brief{b.client ? ` for ${b.client}` : ""}</p>
        <h1>{b.word ? <>What “{b.word}” means for {b.name}</> : <>The look of {b.name}</>}</h1>
        <p className="muted">Your designer read these points from the references they collected. Tell them, point by point, whether this is the look you mean. It takes about two minutes.</p>
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
                    {it.examples.map((f) => <img key={f} src={imgUrl(f)} alt="" loading="lazy" />)}
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
            {state === "sent" ? "Sent. Your designer can see your answers now. Change anything and send again if you need to."
              : state === "error" ? "That didn’t go through. Check your connection and try again."
              : `${answered} of ${b.items.length} answered`}
          </p>
        </div>
      </form>
    </section>
  );
}
