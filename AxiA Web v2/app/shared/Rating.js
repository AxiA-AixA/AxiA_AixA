"use client";

// A 1–5 rating as five buttons. value: 1–5 or null; onChange(n). Click the same number again to clear.
export default function Rating({ label, value, onChange }) {
  return (
    <div className="rating" role="group" aria-label={label}>
      <span className="rating-label">{label}</span>
      <span className="rating-scale">
        <span className="muted">No</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)} aria-label={`${n} of 5`}>{n}</button>
        ))}
        <span className="muted">Yes</span>
      </span>
    </div>
  );
}
