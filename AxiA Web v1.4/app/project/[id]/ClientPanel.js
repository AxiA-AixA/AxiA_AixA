"use client";

import Link from "next/link";
import { plural } from "@/lib/status";

// Steps 3 and 4: share the spec as a link, follow the client's answers, open the agreed brief.
export default function ClientPanel({ id, shared, link, kept, tally, changed, copied, canShare, busy, message, onShare, onCopy }) {
  const waiting = tally.total - tally.answered;
  return (
    <div className="share glass" id="step-client">
      <h2>Client</h2>
      {shared ? (
        <>
          <p className="muted">Your client opens this link, sees each point with its example images and answers Agree, Not sure or Disagree. No account needed.</p>
          <div className="link-row">
            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Client link" />
            <button className="btn primary" onClick={onCopy}>{copied ? "Copied" : "Copy link"}</button>
            <a className="btn" href={link} target="_blank" rel="noopener noreferrer">Preview</a>
          </div>
          <div className="tally-bar" aria-label={`${tally.agree} agreed, ${tally.unsure} not sure, ${tally.disagree} disagreed, ${waiting} unanswered`}>
            {["agree", "unsure", "disagree"].map((k) => <span key={k} className={k} style={{ flex: tally[k] }} />)}
            <span className="none" style={{ flex: waiting }} />
          </div>
          <p className="tally"><b>{tally.agree}</b> agreed · <b>{tally.unsure}</b> not sure · <b>{tally.disagree}</b> disagreed · {waiting} waiting</p>
          {changed && <p className="warn">You’ve changed the spec since sharing. Update the brief so your client sees the same points.</p>}
          <div className="row">
            <button className="btn" onClick={onShare}>{changed ? "Update shared brief" : "Re-share current spec"}</button>
            <Link className="btn primary" href={`/project/${id}/agreed`}>Open agreed brief</Link>
          </div>
        </>
      ) : (
        <>
          <p className="muted">{kept ? `Share the ${plural(kept, "point")} you kept as a link.` : "When the spec has points, share it as a link."} Your client answers each one, and you get an <b>agreed brief</b>: one page with the agreed look, the open questions and their sign-off, ready to attach to your proposal.</p>
          <button className="btn primary" onClick={onShare} disabled={!canShare}>{busy ? "Wait for analysis to finish" : "Share with client"}</button>
        </>
      )}
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  );
}
