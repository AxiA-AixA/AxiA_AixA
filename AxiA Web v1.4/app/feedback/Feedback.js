"use client";

import { useState } from "react";
import Link from "next/link";
import Rating from "../shared/Rating";
import PageHeader from "../shell/PageHeader";

const TRIED = ["Map", "Library", "Project & spec", "Sharing with a client", "Chrome extension"];
const ROLES = ["Designer", "Studio / agency", "Student", "Client side", "Other"];

// The /feedback page (a link to send to testers). In the app it opens from the sidebar instead.
export default function Feedback() {
  return (
    <section className="feedback">
      <PageHeader title="Feedback" sub="Two minutes. Everything is optional; say what you actually felt, good or bad.">
        <Link href="/feedback/summary" className="btn">All feedback</Link>
      </PageHeader>
      <FeedbackForm />
    </section>
  );
}

// Feedback from designers testing AxiA. onDone: called a moment after it was sent (to close a sheet).
export function FeedbackForm({ onDone }) {
  const [f, setF] = useState({ name: "", role: "", tried: [], easy: null, spec: null, use: null, worked: "", confusing: "", missing: "" });
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const set = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }));
  const toggleTried = (t) => setF((cur) => ({ ...cur, tried: cur.tried.includes(t) ? cur.tried.filter((x) => x !== t) : [...cur.tried, t] }));

  async function send(e) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "designer", ...f }) }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
    if (res?.ok && onDone) setTimeout(onDone, 1400);
  }

  if (state === "sent") return <p className="feedback-thanks">Thank you. It goes straight to the AxiA team and shapes what we build next.</p>;

  return (
    <form onSubmit={send} className="feedback-form">
      <div className="fields two">
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
      <label>What worked?<textarea rows={2} value={f.worked} onChange={(e) => set("worked")(e.target.value)} /></label>
      <label>What was confusing?<textarea rows={2} value={f.confusing} onChange={(e) => set("confusing")(e.target.value)} /></label>
      <label>What's missing?<textarea rows={2} value={f.missing} onChange={(e) => set("missing")(e.target.value)} /></label>
      <div className="row">
        <button className="btn primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send feedback"}</button>
        {state === "error" && <span className="error">That didn’t go through. Try again.</span>}
      </div>
    </form>
  );
}
