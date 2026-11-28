"use client";

import { useState } from "react";

const PAGE = 120;

// A grid of library references, used by the Library page and the map's grid view.
//   items       library entries to show
//   onOpen(e)   click on an image
//   selected    Set of ids (with onSelect(id, on)) to show checkboxes for picking many
//   onTags(e, { add?, remove? })  given: hand-added tags can be added and removed on each card
//   terms       [[term, count]] for tag suggestions while typing
export default function RefGrid({ items, onOpen, selected, onSelect, onTags, terms = [], empty = "No references here." }) {
  const [shown, setShown] = useState(PAGE);
  if (!items.length) return <p className="muted grid-empty">{empty}</p>;
  return (
    <>
      <datalist id="tag-terms">{terms.slice(0, 200).map(([t]) => <option key={t} value={t} />)}</datalist>
      <ul className="lib-grid">
        {items.slice(0, shown).map((e) => (
          <Card key={e.id} e={e} onOpen={onOpen} picked={selected?.has(e.id)} onSelect={onSelect} onTags={onTags} />
        ))}
      </ul>
      {items.length > shown && <button className="btn more" onClick={() => setShown(shown + PAGE)}>Show more ({items.length - shown})</button>}
    </>
  );
}

function Card({ e, onOpen, picked, onSelect, onTags }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const mine = new Set(e.userTags.map((t) => t.toLowerCase()));
  const ai = e.tags.filter((t) => !mine.has(t.toLowerCase()));
  const state = e.status === "queued" || e.status === "retry" ? "Waiting…" : e.status === "failed" ? "Couldn’t analyse" : "";

  function submit(ev) {
    ev.preventDefault();
    const tags = text.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length) onTags(e, { add: tags });
    setText(""); setAdding(false);
  }

  return (
    <li className={`lib-card${picked ? " picked" : ""}`}>
      <button className="lib-img" onClick={() => onOpen?.(e)} title={e.title || "Open"}>
        <img src={e.thumb} alt="" loading="lazy" />
        {state && <span className="ref-state">{state}</span>}
      </button>
      {onSelect && (
        <label className="lib-check" title="Select">
          <input type="checkbox" checked={!!picked} onChange={(ev) => onSelect(e.id, ev.target.checked)} aria-label="Select this reference" />
        </label>
      )}
      <div className="lib-tags">
        {e.userTags.map((t) => (
          <span key={t} className="chip mine" title="Your tag">
            {t}
            {onTags && <button className="chip-x" onClick={() => onTags(e, { remove: [t] })} aria-label={`Remove tag ${t}`}>×</button>}
          </span>
        ))}
        {ai.slice(0, 5).map((t) => <span key={t} className="chip ai" title="AI tag">{t}</span>)}
        {ai.length > 5 && <span className="muted more-tags" title={ai.slice(5).join(" · ")}>+{ai.length - 5}</span>}
        {onTags && (adding ? (
          <form onSubmit={submit} className="tag-add">
            <input autoFocus value={text} onChange={(ev) => setText(ev.target.value)} onBlur={submit} list="tag-terms"
              placeholder="tag, another" aria-label="Add tags" onKeyDown={(ev) => ev.key === "Escape" && (setText(""), setAdding(false))} />
          </form>
        ) : (
          <button className="chip add" onClick={() => setAdding(true)} aria-label="Add a tag">+ Tag</button>
        ))}
      </div>
    </li>
  );
}
