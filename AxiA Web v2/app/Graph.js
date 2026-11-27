"use client";

// The reference map: the AxiA symbol in the centre, with the references that share its look around it
// (the ones tagged "AxiA symbol" in Library; until then the closest chrome / metal symbol images).
// The rest of the library is not on the map in this version. This file holds the React side: what is
// shown (search filters, map or grid) and the panels.
// The rest lives in small modules:
//   lib/graph/terms.js   grouping, search terms, suggestions (pure)
//   lib/graph/layout.js  force layout with a quadtree (pure)
//   lib/graph/thumbs.js  image loading into small decoded thumbnails
//   app/graph/camera.js  world <-> screen, zoom, fit
//   app/graph/draw.js    canvas drawing
//   app/graph/input.js   mouse, wheel and touch

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hostOf } from "@/lib/links";
import { KIND, countTerms, fieldNames, passes, suggest } from "@/lib/graph/terms";
import { step } from "@/lib/graph/layout";
import { loadThumb } from "@/lib/graph/thumbs";
import { fetchLibrary } from "@/lib/client/library";
import { camMoved, fitStep, toScreen } from "./graph/camera";
import { drawMap } from "./graph/draw";
import { attachInput } from "./graph/input";
import RefGrid from "./shared/RefGrid";
import { changeTags, symbolRefs } from "./shared/tags";

// Display settings. The sliders are a design tool: they show only with ?tune in the address.
const TUNING = [
  { key: "ring", label: "Distance from the symbol", min: 120, max: 500, step: 10, value: 230 },
  { key: "spread", label: "Spread (dot repulsion)", min: 20, max: 600, step: 10, value: 400 },
  { key: "dot", label: "Image size", min: 6, max: 120, step: 1, value: 15 },
  { key: "showAt", label: "Image shows from radius (px)", min: 3, max: 40, step: 1, value: 5 },
  { key: "lens", label: "Lens reach (px)", min: 40, max: 400, step: 10, value: 220 },
  { key: "lensGain", label: "Lens strength", min: 0, max: 2, step: 0.05, value: 0.15 },
  { key: "hover", label: "Hover size (px)", min: 20, max: 200, step: 2, value: 64 },
  { key: "corner", label: "Corner radius (px)", min: 0, max: 30, step: 1, value: 8 },
];
const DEFAULTS = Object.fromEntries(TUNING.map((t) => [t.key, t.value]));
const SYMBOL_HUB = "AxiA"; // the one hub: the AxiA symbol
const SIDE_W = 340;      // right-hand panel column (matches .side in globals.css)
const POLL_MS = 5000;    // library refresh, so new analysis results move in live
const LAYOUT_MS = 8;     // layout time per frame
const STORE = "axia-tuning-symbol-2"; // new name: the old big-library settings don't carry over
const FILTERS = "axia-map-view"; // searched terms + map/grid, kept for this browser tab

// The map state lives outside React (it changes every frame) and is kept while visiting other
// pages, so coming back shows the same layout. Reset on reload.
let kept = null;
const freshState = () => ({
  nodes: [], byId: new Map(), shownIds: new Set(), hub: null, etag: null,
  cam: { x: 0, y: 0, k: 1 }, shownK: 1, heat: 0, mouse: null, hover: null, dragged: null, userCam: false, dirty: true,
});
const readJSON = (store, key) => { try { return JSON.parse(store.getItem(key) ?? "null"); } catch { return null; } };

export default function Graph() {
  const canvasRef = useRef(null);
  const g = useRef(kept ?? freshState());
  const [count, setCount] = useState(0);         // references in the library
  const [online, setOnline] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [tune, setTune] = useState(DEFAULTS);
  const [showTuning, setShowTuning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  // What is shown: sel = searched terms; mode = "map" or "grid".
  const [view, setView] = useState({ sel: [], mode: "map" });
  const [shownEntries, setShownEntries] = useState([]); // for the grid view
  const [terms, setTerms] = useState([]);        // [[term, count]] among shown images
  const [hits, setHits] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState(null);    // clicked image, shown in the side panel

  // The canvas loop reads these without re-subscribing.
  const viewRef = useRef(view); viewRef.current = view;
  const tuneRef = useRef(tune); tuneRef.current = tune;
  const detailRef = useRef(detail); detailRef.current = detail;
  const panelWas = useRef(true); // the panel folds while an image is open, then comes back as it was
  g.current.dirty = true; // any re-render (settings, filters, panels) redraws once

  // ---------- what is shown ----------
  // Recompute the shown nodes and their links; `heat` lets the layout move again.
  function rebuild(heat = 1, v = viewRef.current) {
    const s = g.current;
    s.hub ??= { id: SYMBOL_HUB, hub: true, symbol: true, x: 0, y: 0, vx: 0, vy: 0, pinned: true }; // stays in the centre
    const items = [...s.byId.values()].filter((n) => s.shownIds.has(n.id) && passes(n.entry, v.sel));
    s.hub.kids = items;
    s.nodes = [s.hub, ...items];
    // An even ring around the symbol, first one at the top. They stay put (drag one to move it).
    const R = tuneRef.current.ring;
    items.forEach((n, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
      Object.assign(n, { parents: [s.hub], x: R * Math.cos(a), y: R * Math.sin(a), vx: 0, vy: 0, pinned: true });
    });
    s.userCam = false;
    s.dirty = true;
    s.heat = Math.max(s.heat, heat);
    // Terms of the shown images only, so each pick narrows the result.
    setTerms(countTerms(items.map((n) => n.entry), v.sel));
    setHits(items.length);
    setShownEntries(items.map((n) => n.entry));
  }

  function changeView(patch) {
    const v = { ...viewRef.current, ...patch };
    viewRef.current = v;
    setView(v);
    try { sessionStorage.setItem(FILTERS, JSON.stringify(v)); } catch {}
    rebuild(1, v);
  }
  const setSelected = (sel) => changeView({ sel });
  const addTerm = (t) => {
    if (!t || viewRef.current.sel.includes(t)) return;
    setSelected([...viewRef.current.sel, t]);
    setQuery(""); setActive(0); setSuggestOpen(false);
  };
  const toggleTerm = (t) => (view.sel.includes(t) ? setSelected(view.sel.filter((x) => x !== t)) : addTerm(t));

  // ---------- library ----------
  // New entries get a node; known ones pick up new analysis results. Then work out which are shown.
  function merge(items) {
    const s = g.current;
    let changed = false;
    for (const e of items) {
      const n = s.byId.get(e.id);
      if (!n) {
        s.byId.set(e.id, { id: e.id, hub: false, entry: e });
        changed = true;
      } else {
        if (n.entry.tags.join() !== e.tags.join()) changed = true;
        n.entry = e;
        if (detailRef.current?.id === e.id) setDetail(e); // keep the open panel current
      }
    }
    const ids = symbolRefs([...s.byId.values()].map((n) => n.entry)).map((e) => e.id);
    if (ids.join() !== [...s.shownIds].join()) { s.shownIds = new Set(ids); changed = true; }
    for (const id of ids) { // only the shown images load their thumbnails
      const n = s.byId.get(id);
      if (!n.loading) { n.loading = true; loadThumb(n, [n.entry.thumb, n.entry.image], () => { s.dirty = true; }); }
    }
    if (changed) rebuild(0.6);
    setCount(ids.length);
  }

  useEffect(() => {
    const s = g.current;
    // Settings are remembered per browser; the view per tab.
    setTune({ ...DEFAULTS, ...readJSON(localStorage, STORE) });
    setShowTuning(new URLSearchParams(location.search).has("tune"));
    if (matchMedia("(max-width: 640px)").matches) { setPanelOpen(false); panelWas.current = false; } // phones: keep the map visible
    const saved = readJSON(sessionStorage, FILTERS);
    if (saved && Array.isArray(saved.sel)) { viewRef.current = { ...viewRef.current, sel: saved.sel, mode: saved.mode === "grid" ? "grid" : "map" }; setView(viewRef.current); }

    if (s.byId.size) { // back from another page: the kept layout as it was
      const userCam = s.userCam;
      Object.assign(s, { mouse: null, hover: null, dragged: null });
      rebuild(0);
      s.userCam = userCam;
      setZoom(s.cam.k); setCount(s.shownIds.size);
    }
    const load = () => fetchLibrary(s.etag)
      .then((d) => { if (d) { s.etag = d.etag; setOnline(d.online); merge(d.items); } })
      .catch(() => setOnline(false));
    loadRef.current = () => { s.etag = null; load(); };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { clearInterval(t); kept = s; };
  }, []);

  function setParam(key, value) {
    const next = { ...tune, [key]: value };
    setTune(next);
    if (key === "ring") { tuneRef.current = next; rebuild(0); }
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  }
  function resetLayout() {
    setTune(DEFAULTS);
    try { localStorage.removeItem(STORE); } catch {}
    tuneRef.current = DEFAULTS;
    rebuild(0);
  }

  function openDetail(e) {
    if (!detailRef.current) { panelWas.current = panelOpen; setPanelOpen(false); }
    setDetail(e); g.current.userCam = false;
  }
  function closeDetail() {
    if (detailRef.current) setPanelOpen(panelWas.current);
    setDetail(null); g.current.userCam = false;
  }
  const openRef = useRef(openDetail); openRef.current = openDetail;
  const loadRef = useRef(() => {});
  // Grid view: hand-made tags can be added and removed on each card.
  async function tagEntry(e, change) {
    try { await changeTags([e.id], change); } catch {}
    loadRef.current();
  }
  const closeRef = useRef(closeDetail); closeRef.current = closeDetail;

  // ---------- canvas loop: layout, camera, draw only when something changed ----------
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext("2d"), s = g.current;
    const css = getComputedStyle(document.documentElement), colors = {};
    const color = (v) => (colors[v] ??= css.getPropertyValue(v).trim());
    const phone = () => canvas.clientWidth <= 640;
    // The symbol is a bit larger than the images around it.
    const hubR = () => Math.max(40, Math.min(80, 50 * s.cam.k)); // half the symbol's width, px
    const pos = (n) => toScreen(s.cam, canvas, n);
    const hubAt = (m) => m && s.nodes.findLast((n) => n.hub && Math.hypot(pos(n).x - m.x, pos(n).y - m.y) <= Math.max(hubR(n), 10));
    // Hub circles keep a screen-px gap; the zoom used is floored so it can't feed back into fitting
    // (wider gap -> zoom out -> wider gap). Far out, many hubs may overlap a little.
    const hubGap = (a, b) => (hubR(a) + hubR(b) + 36) / Math.max(s.cam.k, phone() ? 0.03 : 0.08);

    let raf;
    const frame = () => {
      if (viewRef.current.mode === "grid") { raf = requestAnimationFrame(frame); return; } // the map is hidden
      const start = performance.now(), settings = { spread: tuneRef.current.spread, hubGap };
      let moving = step(s, settings);
      while (moving && !s.dragged && performance.now() - start < LAYOUT_MS) step(s, settings);

      let fitted = false;
      if (!s.userCam && s.nodes.length) { // keep every dot in view until the user zooms or drags
        const before = s.cam;
        s.cam = fitStep(s.cam, canvas, s.nodes, {
          pad: 2 * tuneRef.current.dot * s.cam.k + 80, // room for the images around the ring
          side: phone() ? 0 : SIDE_W + 48, top: phone() ? 210 : 0, // where the panels cover the map
        });
        fitted = camMoved(before, s.cam);
        if (Math.abs(s.cam.k - s.shownK) > 0.01) { s.shownK = s.cam.k; setZoom(s.cam.k); }
      }
      const resized = canvas.width !== canvas.clientWidth * (devicePixelRatio || 1);
      if (moving || fitted || resized || s.dirty || s.animating) {
        s.dirty = false;
        const open = detailRef.current && s.byId.get(detailRef.current.id);
        drawMap(ctx, { canvas, s, t: tuneRef.current, color, hubR, hubAt, pos, picked: open && s.nodes.includes(open) ? open : null });
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    const detach = attachInput(canvas, s, { hubAt, onOpen: (e) => openRef.current(e), onZoom: setZoom });
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); detach(); removeEventListener("keydown", onKey); };
  }, []);

  // ---------- panels ----------
  const suggestions = suggest(terms, query);
  const showSuggest = suggestOpen && suggestions.length > 0;
  const q = query.trim().toLowerCase();
  function onSearchKey(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestOpen(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + suggestions.length) % Math.max(1, suggestions.length));
    } else if (e.key === "Escape") {
      e.stopPropagation(); // close the list, not the detail panel
      setSuggestOpen(false);
    } else if (e.key === "Backspace" && !query && view.sel.length) {
      setSelected(view.sel.slice(0, -1)); // like a token field
    }
  }

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="graph" style={view.mode === "grid" ? { display: "none" } : undefined} />
      {view.mode === "grid" && (
        <div className="map-grid">
          <RefGrid items={shownEntries} onOpen={openDetail} onTags={tagEntry} terms={terms}
            empty="No references match. Remove a filter to see more." />
        </div>
      )}
      <div className="side">
        <div className="tag-search glass">
          <p className="tag-status">
            {!online ? "AI analyser is off — open axia-prototype/Axia-실행-Mac.command"
              : view.sel.length ? `${hits} of ${count} references around the AxiA symbol` : `${count} references around the AxiA symbol · ${terms.length} tags`}
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (showSuggest) addTerm(suggestions[active]?.[0]); }} role="search">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input value={query} placeholder={view.sel.length ? "Add another filter" : "Search tags, types, groups, platforms"}
              aria-label="Search tags" role="combobox" aria-autocomplete="list" aria-expanded={showSuggest}
              aria-controls="tag-suggest" aria-activedescendant={showSuggest ? `tag-suggest-${active}` : undefined}
              onChange={(e) => { setQuery(e.target.value); setActive(0); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)} onClick={() => setSuggestOpen(true)}
              onBlur={() => setSuggestOpen(false)} onKeyDown={onSearchKey} />
            {showSuggest && (
              <ul id="tag-suggest" className="suggest" role="listbox" aria-label="Tag suggestions">
                <li className="suggest-head" role="presentation">{q ? "Tags" : view.sel.length ? "Related tags" : "Popular tags"}</li>
                {suggestions.map(([t, n], i) => {
                  const at = q ? t.toLowerCase().indexOf(q) : -1;
                  return (
                    <li key={t} id={`tag-suggest-${i}`} role="option" aria-selected={i === active}
                      onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); addTerm(t); }}>
                      <span>{at < 0 ? t : <>{t.slice(0, at)}<mark>{t.slice(at, at + q.length)}</mark>{t.slice(at + q.length)}</>}</span>
                      <span className="suggest-count">{KIND.get(t) && <em>{KIND.get(t)} · </em>}{n}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </form>
          {view.sel.length > 0 && (
            <div className="tag-chips">
              {view.sel.map((t) => (
                <button key={t} type="button" className="chip on" aria-label={`Remove ${t} filter`} title="Remove"
                  onClick={() => setSelected(view.sel.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>
              ))}
              {view.sel.length > 1 && <button type="button" className="btn" onClick={() => setSelected([])}>Clear all</button>}
            </div>
          )}
          <div className="segmented view-toggle" role="group" aria-label="View">
            <button type="button" aria-pressed={view.mode !== "grid"} onClick={() => changeView({ mode: "map" })}>Map</button>
            <button type="button" aria-pressed={view.mode === "grid"} onClick={() => changeView({ mode: "grid" })}>Grid {hits ? `· ${hits}` : ""}</button>
          </div>
        </div>

        {detail && (
          <section className="detail glass" aria-label="Selected reference">
            <div className="detail-bar">
              <span>{fieldNames(detail).join(" · ")}</span>
              <button type="button" className="btn" onClick={closeDetail}>Close ×</button>
            </div>
            <img src={detail.image} alt={detail.title || "Reference image"} />
            {detail.title && <h2>{detail.title}</h2>}
            {!detail.tags.length && <p>Analysing… tags will appear here.</p>}
            <div className="detail-tags">
              {detail.tags.map((t) => (
                <button key={t} type="button" className={view.sel.includes(t) ? "chip on" : "chip"}
                  title={view.sel.includes(t) ? "Remove this tag filter" : "Filter the map by this tag"}
                  onClick={() => toggleTerm(t)}>{t}</button>
              ))}
            </div>
            {detail.url && (
              <a href={detail.url} target="_blank" rel="noopener noreferrer" className="btn primary detail-source">
                View source on {hostOf(detail.url)} ↗
              </a>
            )}
          </section>
        )}

        <details className="tuning glass" open={panelOpen} onToggle={(e) => setPanelOpen(e.currentTarget.open)}>
          <summary>Display <span>· zoom {zoom.toFixed(2)}</span></summary>
          {showTuning && TUNING.map((p) => (
            <label key={p.key}>
              <span>{p.label}</span>
              <output>{tune[p.key]}</output>
              <input type="range" min={p.min} max={p.max} step={p.step} value={tune[p.key]}
                style={{ "--p": `${((tune[p.key] - p.min) / (p.max - p.min)) * 100}%` }}
                onChange={(e) => setParam(p.key, Number(e.target.value))} />
            </label>
          ))}
          <div className="tuning-actions">
            <button type="button" className="btn" onClick={() => { g.current.userCam = false; }}>Fit view</button>
            <button type="button" className="btn" title="Unpin dots you moved and lay the map out again" onClick={resetLayout}>Reset</button>
          </div>
        </details>
      </div>
      {count === 0 && online && (
        <div className="empty">
          <h1>No symbol references yet</h1>
          <p>The map shows the AxiA symbol with the references that share its look. Tag images “AxiA symbol” in Library (select them, then “Show on map’s first screen”).</p>
          <Link href="/library" className="btn primary">Open Library</Link>
        </div>
      )}
    </div>
  );
}
