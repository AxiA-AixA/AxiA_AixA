"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FeedbackForm } from "../feedback/Feedback";

// Feedback in a sheet over the page, from the sidebar, so it never means leaving what you were doing.
export default function FeedbackSheet({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Send feedback" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head">
          <h2>How is AxiA working for you?</h2>
          <Link href="/feedback/summary" className="btn" onClick={onClose}>All feedback</Link>
          <button type="button" className="btn icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <FeedbackForm onDone={onClose} />
      </div>
    </div>
  );
}
