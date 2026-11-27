"use client";

// Library: every reference, with their tags. Add references (links, files, ⌘V, drop), search,
// and add your own tags to one image or to many selected at once. Your tags count like the AI's
// everywhere (map, search, spec). Tag images "AxiA symbol" to put them on the map's first screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLibrary, OFFLINE } from "@/lib/client/library";
import { countTerms, passes, suggest } from "@/lib/graph/terms";
import { useAddReferences } from "../shared/useAddReferences";
import { changeTags, SHOWCASE_TAG, withUserTags } from "../shared/tags";
import RefGrid from "../shared/RefGrid";
import PageHeader from "../shell/PageHeader";

const POLL_MS = 4000;

export default function Library() {
  const [lib, setLib] = useState({ online: true, items: [] });
  const etag = useRef(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const [open, setOpen] = useState(null);
  const linkInput = useRef(null);
  const fileInput = useRef(null);

  // The sidebar's search opens /library?q=…
  useEffect(() => {
    const read = () => { const q = new URLSearchParams(location.search).get("q"); if (q != null) setQuery(q); };
    const onSearch = (e) => setQuery(e.detail);
    read();
    addEventListener("popstate", read);
    addEventListener("axia-search", onSearch); // searched again while already here
    return () => { removeEventListener("popstate", read); removeEventListener("axia-search", onSearch); };
  }, []);

  const reload = useCallback(() => fetchLibrary(etag.current)
    .then((d) => { if (d) { etag.current = d.etag; setLib(d); } })
    .catch(() => setLib(OFFLINE)), []);
  useEffect(() => { reload(); const t = setInterval(reload, POLL_MS); return () => clearInterval(t); }, [reload]);

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
    passes(e, filters) && (!onlyMine || e.userTags.length) &&
    (!q || e.tags.some((t) => t.toLowerCase().includes(q)) || (e.title ?? "").toLowerCase().includes(q) || (e.url ?? "").toLowerCase().includes(q))
  ), [lib.items, filters, onlyMine, q]);
  const terms = useMemo(() => countTerms(shown, filters), [shown, filters]);
  const allTerms = useMemo(() => countTerms(lib.items), [lib.items]);
  const ideas = suggest(terms, "", 12);

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
      <PageHeader title={<>Library <span className="muted">{lib.items.length}</span></>}
        sub="Everything you’ve saved, with the AI’s tags and your own. Select several images to tag them at once.">
        <button className="btn outline" onClick={() => fileInput.current?.click()} disabled={!lib.online}>Upload images</button>
      </PageHeader>

      {!lib.online && <p className="notice glass">The AI analyser (axia-prototype) is off. Open <code>Axia-실행-Mac.command</code> in the axia-prototype folder, then refresh.</p>}

      <div className="add-bar glass">
        <form onSubmit={async (e) => { e.preventDefault(); if (await adder.addLinks(link)) setLink(""); }}>
          <input ref={linkInput} value={link} onChange={(e) => setLink(e.target.value)} aria-label="Reference link"
            placeholder="Paste a link: Pinterest, Instagram, Are.na, Cosmos, Behance, Dribbble, a portfolio site or an image" />
          <button className="btn primary" disabled={!link.trim() || !lib.online}>Add</button>
        </form>
        <div className="add-ways">
          <span className="muted">Or drop images anywhere · ⌘V a screenshot{adder.uploading ? ` · adding ${adder.uploading}…` : ""}</span>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { adder.addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {adder.error && <p className="error" role="alert">{adder.error}</p>}
      </div>

      <div className="lib-tools">
        <input className="lib-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tags, titles or sites" aria-label="Search the library" />
        <div className="segmented" role="group" aria-label="Show">
          <button aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>All</button>
          <button aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>With my tags</button>
        </div>
        <span className="muted">{shown.length} shown</span>
      </div>
      <div className="tag-chips">
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
          <button className="btn" onClick={() => setSelected(new Set(shown.map((e) => e.id)))}>Select all {shown.length}</button>
          <button className="btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      {msg && <p className="muted lib-msg" role="status">{msg}</p>}

      <RefGrid items={shown} terms={allTerms} selected={selected} onSelect={select} onOpen={setOpen}
        onTags={(e, change) => tag([e.id], change)}
        empty={lib.items.length ? "Nothing matches. Clear the search or filters." : "No references yet. Paste a link above or drop images here."} />

      {open && (
        <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="Reference" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="lib-detail glass">
            <img src={open.image} alt={open.title || ""} />
            <div>
              {open.title && <h2>{open.title}</h2>}
              {open.url && <a href={open.url} target="_blank" rel="noopener noreferrer">{open.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} ↗</a>}
              <p className="muted">{open.tags.join(" · ") || "Not tagged yet"}</p>
              <button className="btn primary" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {adder.dragging && <div className="drop-overlay" aria-hidden="true"><p>Drop to add to your library</p></div>}
    </section>
  );
}
