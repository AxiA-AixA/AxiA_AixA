"use client";

import { useEffect, useMemo, useState } from "react";

const PAGE = 120;

// Pick references for a project from the whole library. Filter by tags (every chosen tag must
// match), click a thumbnail to add or remove it. Changes save as you click.
export default function Picker({ items, chosen, onToggle, onClose }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState([]);
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const picked = new Set(chosen);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (onlyChosen && !picked.has(i.id)) return false;
      const terms = [...i.tags, ...i.colors, ...i.fields].map((t) => t.toLowerCase());
      if (!tags.every((t) => terms.includes(t.toLowerCase()))) return false;
      return !q || terms.some((t) => t.startsWith(q)) || (i.title ?? "").toLowerCase().includes(q);
    });
  }, [items, query, tags, onlyChosen, chosen]);

  // Tags most common among what's shown, to narrow down with one click.
  const top = useMemo(() => {
    const c = new Map();
    for (const i of filtered) for (const t of i.tags) if (!tags.includes(t)) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [filtered, tags]);

  useEffect(() => setShown(PAGE), [query, tags, onlyChosen]);

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="Add references" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker glass">
        <div className="picker-head">
          <h2>Add references <span className="muted">{chosen.length} in project</span></h2>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
        <div className="picker-tools">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tags or titles: matte, studio, 3d…" autoFocus />
          <div className="segmented">
            <button aria-pressed={!onlyChosen} onClick={() => setOnlyChosen(false)}>All {items.length}</button>
            <button aria-pressed={onlyChosen} onClick={() => setOnlyChosen(true)}>In project {chosen.length}</button>
          </div>
        </div>
        <div className="tag-chips">
          {tags.map((t) => (
            <button key={t} className="chip on" onClick={() => setTags(tags.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>
          ))}
          {top.map(([t, n]) => (
            <button key={t} className="chip" onClick={() => setTags([...tags, t])}>{t} <span className="muted">{n}</span></button>
          ))}
        </div>
        <p className="muted picker-count">{filtered.length} reference{filtered.length === 1 ? "" : "s"}{items.length === 0 && " · add some with the Chrome extension (“Send to AxiA”) first"}</p>
        <ul className="picker-grid">
          {filtered.slice(0, shown).map((i) => (
            <li key={i.id}>
              <button className={picked.has(i.id) ? "on" : ""} onClick={() => onToggle(i.id)} aria-pressed={picked.has(i.id)} title={i.tags.slice(0, 6).join(" · ")}>
                <img src={i.image} alt={i.title || ""} loading="lazy" />
                {picked.has(i.id) && <span className="check" aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
        {filtered.length > shown && <button className="btn more" onClick={() => setShown(shown + PAGE)}>Show more</button>}
      </div>
    </div>
  );
}
