import { hostOf } from "@/lib/links";
import { fieldNames } from "@/lib/graph/terms";

// One reference, large, in the right-hand panel (map and Library): image, title, tags, source.
// isOn(tag): the tag is a filter now; onTag(tag): a tag was clicked (filter by it). children: extra actions.
export default function RefDetail({ entry, onClose, isOn = () => false, onTag, children }) {
  return (
    <section className="detail" aria-label="Selected reference">
      <div className="detail-bar">
        <span>{fieldNames(entry).join(" · ")}</span>
        <button type="button" className="btn" onClick={onClose}>Close ×</button>
      </div>
      <img src={entry.image} alt={entry.title || "Reference image"} />
      {entry.title && <h2>{entry.title}</h2>}
      {!entry.tags.length && <p>Analysing… tags will appear here.</p>}
      {entry.status === "failed" && <p>Couldn’t analyse this image{/429|quota/i.test(entry.error ?? "") ? ": the AI’s daily limit was reached" : ""}.</p>}
      <div className="detail-tags">
        {entry.tags.map((t) => (
          <button key={t} type="button" className={isOn(t) ? "chip on" : "chip"}
            title={isOn(t) ? "Remove this tag filter" : "Filter by this tag"} onClick={() => onTag?.(t)}>{t}</button>
        ))}
      </div>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="btn primary detail-source">
          View source on {hostOf(entry.url)} ↗
        </a>
      )}
      {children}
    </section>
  );
}
