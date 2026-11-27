"use client";

import { useState } from "react";
import Link from "next/link";
import Rating from "../shared/Rating";

const TRIED = ["Map", "Library", "Project & spec", "Sharing with a client", "Chrome extension"];
const ROLES = ["Designer", "Studio / agency", "Student", "Client side", "Other"];

// Feedback from designers testing AxiA. Two minutes; everything is optional.
export default function Feedback() {
  const [f, setF] = useState({ name: "", role: "", tried: [], easy: null, spec: null, use: null, worked: "", confusing: "", missing: "" });
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const set = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }));
  const toggleTried = (t) => setF((cur) => ({ ...cur, tried: cur.tried.includes(t) ? cur.tried.filter((x) => x !== t) : [...cur.tried, t] }));

  async function send(e) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "designer", ...f }) }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return (
      <section className="feedback">
        <h1>Thank you</h1>
        <p className="muted">Your feedback goes straight to the AxiA team. It shapes what we build next.</p>
        <p><Link className="btn primary" href="/">Back to AxiA</Link></p>
      </section>
    );
  }

  return (
    <section className="feedback">
      <header className="page-head">
        <h1>How was AxiA?</h1>
        <p>Two minutes. Everything is optional; say what you actually felt, good or bad. <Link href="/feedback/summary">See all feedback →</Link></p>
      </header>
      <form onSubmit={send} className="feedback-form glass">
        <div className="fields">
          <label>Name<input value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="Optional" /></label>
          <label>You are
            <select value={f.role} onChange={(e) => set("role")(e.target.value)}>
              <option value="">Choose…</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>What did you try?</legend>
          <div className="tag-chips">
            {TRIED.map((t) => <button key={t} type="button" className={f.tried.includes(t) ? "chip on" : "chip"} aria-pressed={f.tried.includes(t)} onClick={() => toggleTried(t)}>{t}</button>)}
          </div>
        </fieldset>
        <Rating label="It was easy to use" value={f.easy} onChange={set("easy")} />
        <Rating label="The spec matched what I see in my references" value={f.spec} onChange={set("spec")} />
        <Rating label="I'd use it with a real client" value={f.use} onChange={set("use")} />
        <label>What worked?<textarea rows={3} value={f.worked} onChange={(e) => set("worked")(e.target.value)} /></label>
        <label>What was confusing?<textarea rows={3} value={f.confusing} onChange={(e) => set("confusing")(e.target.value)} /></label>
        <label>What's missing?<textarea rows={3} value={f.missing} onChange={(e) => set("missing")(e.target.value)} /></label>
        <div className="row">
          <button className="btn primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send feedback"}</button>
          {state === "error" && <span className="error">That didn’t go through. Try again.</span>}
        </div>
      </form>
    </section>
  );
}
