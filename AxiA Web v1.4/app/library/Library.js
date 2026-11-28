"use client";

// Library: every reference, with their tags. Add references (links, files, ⌘V, drop, Instagram JSON), search,
// and add your own tags to one image or to many selected at once. Your tags count like the AI's
// everywhere (map, search, spec). Tag images "AxiA symbol" to put them on the map's first screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLibrary, OFFLINE } from "@/lib/client/library";
import { countTerms, passes, suggest } from "@/lib/graph/terms";
import { useAddReferences } from "../shared/useAddReferences";
import { changeTags, SHOWCASE_TAG, withUserTags } from "../shared/tags";
import RefGrid from "../shared/RefGrid";
import RefDetail from "../shared/RefDetail";
import HeadTools from "../shell/HeadTools";

const POLL_MS = 4000;
// The Show filter: which references are listed.
const SHOW = {
  all: () => true,
  mine: (e) => e.userTags.length > 0,
  waiting: (e) => e.status === "queued" || e.status === "retry" || e.status === "new",
  failed: (e) => e.status === "failed",
};

export default function Library() {
  const [lib, setLib] = useState({ online: true, items: [] });
  const etag = useRef(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [show, setShow] = useState("all"); // all | mine | waiting (for the AI) | failed
  const [selected, setSelected] = useState(new Set());
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const [open, setOpen] = useState(null);
  const linkInput = useRef(null);
  const fileInput = useRef(null);
  const jsonInput = useRef(null);

  const reload = useCallback(() => fetchLibrary(etag.current)
    .then((d) => { if (d) { etag.current = d.etag; setLib(d); } })
    .catch(() => setLib(OFFLINE)), []);
  useEffect(() => { reload(); const t = setInterval(reload, POLL_MS); return () => clearInterval(t); }, [reload]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(null); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const adder = useAddReferences("/api/library/add", {
    after: reload, linkInput,
    onResult: (d) => d.added?.length && setMsg(`Added ${d.added.length} reference${d.added.length === 1 ? "" : "s"}. AxiA is tagging them.`),
  });

  // Show the new tags at once, then save; the next poll brings the saved state.
  async function tag(ids, change) {
    setLib((cur) => ({ ...cur, items: cur.items.map((e) => {
      if (!ids.includes(e.id)) return e;
      const drop = new Set((change.remove ?? []).map((t) => t.toLowerCase()));
      const have = e.userTags.filter((t) => !drop.has(t.toLowerCase()));
      const add = (change.add ?? []).filter((t) => !have.some((h) => h.toLowerCase() === t.toLowerCase()));
      return withUserTags(e, [...have, ...add]);
    }) }));
    try { await changeTags(ids, change); etag.current = null; reload(); }
    catch (err) { setMsg(err.message); etag.current = null; reload(); }
  }

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => lib.items.filter((e) =>
    passes(e, filters) && SHOW[show](e) &&
    (!q || e.tags.some((t) => t.toLowerCase().includes(q)) || (e.title ?? "").toLowerCase().includes(q) || (e.url ?? "").toLowerCase().includes(q))
  ), [lib.items, filters, show, q]);
  const terms = useMemo(() => countTerms(shown, filters), [shown, filters]);
  const allTerms = useMemo(() => countTerms(lib.items), [lib.items]);
  const ideas = suggest(terms, "", 12);

  // Instagram: the JSON the saved-posts collector extension exports.
  async function importJson(file) {
    if (!file) return;
    setMsg("Importing Instagram JSON… a large file can take a few minutes.");
    try {
      const res = await fetch("/api/library/import", { method: "POST", headers: { "content-type": "application/json" }, body: await file.text() });
      const d = await res.json();
      setMsg(d.error ?? `Added ${d.added} from Instagram (${d.new} new${d.failed ? `, ${d.failed} failed: usually expired thumbnail links` : ""}). AxiA is tagging them.`);
    } catch { setMsg("Couldn't import that file. Check that it's the extension's JSON and that AxiA is running."); }
    etag.current = null; reload();
  }

  // Analysis: how many are waiting for the AI or couldn't be read, and asking it again.
  const waiting = lib.items.filter(SHOW.waiting).length, failed = lib.items.filter(SHOW.failed);
  const limitHit = failed.some((e) => /429|quota/i.test(e.error ?? ""));
  async function retag(body, what) {
    try {
      const res = await fetch("/api/library/retag", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      setMsg(d.error ?? `${d.queued} ${what} queued for analysis again.`);
    } catch { setMsg("Couldn't reach the analyser. Check that AxiA is running."); }
    etag.current = null; reload();
  }

  const select = (id, on) => setSelected((cur) => { const next = new Set(cur); on ? next.add(id) : next.delete(id); return next; });
  const ids = [...selected];
  function bulkAdd(e) {
    e.preventDefault();
    const tags = bulk.split(",").map((t) => t.trim()).filter(Boolean);
    if (!tags.length || !ids.length) return;
    tag(ids, { add: tags });
    setMsg(`Added “${tags.join(", ")}” to ${ids.length} reference${ids.length === 1 ? "" : "s"}.`);
    setBulk("");
  }

  return (
    <section className="library">
      {/* In the header row: search */}
      <HeadTools>
        <input id="page-search" className="tool-search glass" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tags, titles or sites" aria-label="Search the library" />
        <span className="muted head-count">{shown.length === lib.items.length ? `${lib.items.length} references` : `${shown.length} of ${lib.items.length}`}</span>
      </HeadTools>

      {!lib.online && <p className="notice glass">The AI analyser (axia-prototype) is off. Open <code>Axia-실행-Mac.command</code> in the axia-prototype folder, then refresh.</p>}

      {/* Adding references, all three ways in one box: a link, image files, an Instagram export */}
      <div className="add-bar glass">
        <p className="add-title">Add references</p>
        <form onSubmit={async (e) => { e.preventDefault(); if (await adder.addLinks(link)) setLink(""); }}>
          <input ref={linkInput} value={link} onChange={(e) => setLink(e.target.value)} aria-label="Reference link"
            placeholder="Paste a link: Pinterest, Instagram, Are.na, Cosmos, Behance, Dribbble, a portfolio site or an image" />
          <button className="btn primary" disabled={!link.trim() || !lib.online}>Add</button>
        </form>
        <div className="add-ways">
          <button className="btn outline" onClick={() => fileInput.current?.click()} disabled={!lib.online}>Upload images</button>
          <button className="btn outline" title="JSON exported from the Instagram saved-posts collector extension" onClick={() => jsonInput.current?.click()} disabled={!lib.online}>Instagram JSON</button>
          <span className="muted">or drop images anywhere · ⌘V a screenshot{adder.uploading ? ` · adding ${adder.uploading}…` : ""}</span>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { adder.addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={jsonInput} type="file" accept=".json,application/json" hidden onChange={(e) => { importJson(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {adder.error && <p className="error" role="alert">{adder.error}</p>}
      </div>

      {/* Analysis: what's still with the AI, what it couldn't read */}
      {(waiting > 0 || failed.length > 0) && (
        <div className="analysis-bar">
          {waiting > 0 && <span><i className="dot wait" />{waiting} waiting for the AI</span>}
          {failed.length > 0 && <span><i className="dot fail" />{failed.length} couldn’t be analysed</span>}
          {limitHit && <span className="muted">The AI’s free daily limit was reached; it resets at 08:00 UTC (17:00 in Korea).</span>}
          <span className="head-spacer" />
          {failed.length > 0 && <button className="btn outline" onClick={() => retag({ statuses: ["failed"] }, `${failed.length === 1 ? "reference" : "references"}`)} disabled={!lib.online}>Re-analyse failed ({failed.length})</button>}
        </div>
      )}

      <div className="tag-chips">
        <div className="segmented" role="group" aria-label="Show">
          <button aria-pressed={show === "all"} onClick={() => setShow("all")}>All</button>
          <button aria-pressed={show === "mine"} onClick={() => setShow("mine")}>With my tags</button>
          {waiting > 0 && <button aria-pressed={show === "waiting"} onClick={() => setShow("waiting")}>Waiting {waiting}</button>}
          {failed.length > 0 && <button aria-pressed={show === "failed"} onClick={() => setShow("failed")}>Couldn’t analyse {failed.length}</button>}
        </div>
        {filters.map((t) => <button key={t} className="chip on" onClick={() => setFilters(filters.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>)}
        {ideas.map(([t, n]) => <button key={t} className="chip" onClick={() => setFilters([...filters, t])}>{t} <span className="muted">{n}</span></button>)}
      </div>

      {ids.length > 0 && (
        <div className="bulk-bar glass" role="region" aria-label="Selected references">
          <b>{ids.length} selected</b>
          <form onSubmit={bulkAdd}>
            <input value={bulk} onChange={(e) => setBulk(e.target.value)} list="tag-terms" placeholder="Add tags to all, e.g. warm, campaign" aria-label="Tags for the selected references" />
            <button className="btn primary" disabled={!bulk.trim()}>Add tags</button>
          </form>
          <button className="btn" title="These show on the map's first screen" onClick={() => { tag(ids, { add: [SHOWCASE_TAG] }); setMsg(`${ids.length} reference${ids.length === 1 ? "" : "s"} will show on the map’s first screen.`); }}>
            Show on map’s first screen
          </button>
          <button className="btn" onClick={() => retag({ ids }, ids.length === 1 ? "reference" : "references")}>Re-analyse</button>
          <button className="btn" onClick={() => setSelected(new Set(shown.map((e) => e.id)))}>Select all {shown.length}</button>
          <button className="btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      {msg && <p className="muted lib-msg" role="status">{msg}</p>}

      <RefGrid items={shown} terms={allTerms} selected={selected} onSelect={select} onOpen={setOpen}
        onTags={(e, change) => tag([e.id], change)}
        empty={lib.items.length ? "Nothing matches. Clear the search or filters." : "No references yet. Paste a link above or drop images here."} />

      {/* The clicked image, large, over the page on the right */}
      {open && (
        <aside className="inspector" aria-label="Selected reference">
          <RefDetail entry={open} onClose={() => setOpen(null)} isOn={(t) => filters.includes(t)}
            onTag={(t) => setFilters(filters.includes(t) ? filters.filter((x) => x !== t) : [...filters, t])}>
            <button className="btn outline" onClick={() => retag({ ids: [open.id] }, "reference")}>Re-analyse this image</button>
          </RefDetail>
        </aside>
      )}
      {adder.dragging && <div className="drop-overlay" aria-hidden="true"><p>Drop to add to your library</p></div>}
    </section>
  );
}
