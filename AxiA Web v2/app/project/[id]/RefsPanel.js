"use client";

import { useRef } from "react";
import { ENOUGH } from "@/lib/status";

export const isAnalysing = (r) => r.status === "queued" || r.status === "retry";

// Step 1: the project's references, and every way to add more.
export default function RefsPanel({ refs, online, adder, link, setLink, linkInput, onPick, onRemove, onRetry }) {
  const busy = refs.filter(isAnalysing).length;
  const unread = refs.filter((r) => r.status === "failed" || r.status === "new").length;
  const fileInput = useRef(null);
  const status = refs.length < ENOUGH ? `${ENOUGH}–20 work best` : busy ? `${busy} being analysed` : unread ? `${unread} not analysed` : "All analysed";

  async function submitLink(e) {
    e.preventDefault();
    if (await adder.addLinks(link)) setLink("");
  }

  return (
    <div className="refs-col" id="step-refs">
      <div className="col-head">
        <h2>References <span className="muted">{refs.length}</span></h2>
        <span className="muted">{status}</span>
      </div>

      <div className="add-bar glass">
        <form onSubmit={submitLink}>
          <input ref={linkInput} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Pinterest, Instagram or image link" aria-label="Reference link" />
          <button className="btn primary" disabled={!link.trim() || !online}>Add</button>
        </form>
        <div className="add-ways">
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={!online}>Upload images</button>
          <button className="btn" onClick={onPick} disabled={!online}>From library</button>
          <span className="muted">or drop images here · ⌘V a screenshot</span>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { adder.addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {adder.error && <p className="error" role="alert">{adder.error}</p>}
      </div>

      {refs.length === 0 && !adder.uploading ? (
        <div className="drop-empty">
          <p><b>Start with what your client showed you.</b></p>
          <p className="muted">Drop the images from their brief, paste links to their Pinterest pins, or pick from what you’ve saved. AxiA reads each image with the same fixed tags, then writes the spec.</p>
        </div>
      ) : (
        <ul className="ref-grid">
          {refs.map((r) => (
            <li key={r.id} className={isAnalysing(r) ? "analysing" : r.status === "failed" ? "failed" : ""} title={r.tags.join(" · ")}>
              <img src={r.thumb} alt={r.title || ""} loading="lazy" />
              {isAnalysing(r) && <span className="ref-state">Analysing…</span>}
              {(r.status === "failed" || r.status === "new") && (
                <button className="ref-state retry" onClick={() => onRetry(r.id)} title={r.error ?? "Not analysed yet"}>
                  {r.status === "failed" ? "Couldn’t analyse · Retry" : "Analyse"}
                </button>
              )}
              <button className="ref-x" onClick={() => onRemove(r.id)} aria-label="Remove from project">×</button>
            </li>
          ))}
          {Array.from({ length: adder.uploading }, (_, i) => <li key={`up-${i}`} className="uploading"><span className="ref-state">Adding…</span></li>)}
        </ul>
      )}
    </div>
  );
}
