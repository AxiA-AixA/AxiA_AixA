"use client";

// The reference map: every library image as a dot, linked to hubs (its colours, types, tags…).
// This file holds the React side: what is shown (filters, grouping, project) and the panels.
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
import { GROUP_BY, KIND, countTerms, fieldNames, passes, suggest } from "@/lib/graph/terms";
import { place, step } from "@/lib/graph/layout";
import { loadThumb } from "@/lib/graph/thumbs";
import { fetchLibrary } from "@/lib/client/library";
import { camMoved, fitStep, toScreen } from "./graph/camera";
import { drawMap } from "./graph/draw";
import { attachInput } from "./graph/input";

// Display settings. The sliders are a design tool: they show only with ?tune in the address.
const TUNING = [
  { key: "spread", label: "Spread (dot repulsion)", min: 20, max: 600, step: 10, value: 400 },
  { key: "dot", label: "Dot size", min: 2, max: 12, step: 0.5, value: 12 },
  { key: "showAt", label: "Image shows from radius (px)", min: 3, max: 40, step: 1, value: 5 },
  { key: "lens", label: "Lens reach (px)", min: 40, max: 400, step: 10, value: 400 },
  { key: "lensGain", label: "Lens strength", min: 0, max: 8, step: 0.1, value: 5 },
  { key: "hover", label: "Hover size (px)", min: 20, max: 160, step: 2, value: 60 },
  { key: "corner", label: "Corner radius when large (px)", min: 0, max: 30, step: 1, value: 10 },
];
const DEFAULTS = Object.fromEntries(TUNING.map((t) => [t.key, t.value]));
const HUB_DOTS = 2;      // hub circle radius = this × dot size (screen px)
const SIDE_W = 340;      // right-hand panel column (matches .side in globals.css)
const POLL_MS = 5000;    // library refresh, so new analysis results move in live
const LAYOUT_MS = 8;     // layout time per frame
const STORE = "axia-tuning";
const FILTERS = "axia-filters"; // searched terms + grouping + project, kept for this browser tab

// The map state lives outside React (it changes every frame) and is kept while visiting other
// pages, so coming back shows the same layout. Reset on reload.
let kept = null;
const freshState = () => ({
  nodes: [], byId: new Map(), hubs: new Map(), hubCache: new Map(), etag: null,
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
  const [view, setView] = useState({ by: "Color", sel: [], auto: false, proj: null }); // what is shown
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
  const keysOf = (e, v = viewRef.current) => (v.by === "Tags" && v.sel.length ? v.sel : GROUP_BY[v.by](e));

  function hubFor(key) {
    const s = g.current;
    if (!s.hubs.has(key)) {
      const h = s.hubCache.get(key) ?? place({ id: key, hub: true }); // hubs keep their place across rebuilds
      h.kids = [];
      s.hubCache.set(key, h);
      s.hubs.set(key, h);
      s.nodes.push(h);
    }
    return s.hubs.get(key);
  }

  // Recompute the shown nodes and their links; `heat` lets the layout move again.
  function rebuild(heat = 1, v = viewRef.current) {
    const s = g.current;
    const proj = v.proj?.refs;
    const items = [...s.byId.values()].filter((n) => passes(n.entry, v.sel) && (!proj || proj.includes(n.id)));
    s.nodes = [...items];
    s.hubs.clear();
    for (const n of items) {
      n.parents = keysOf(n.entry, v).map(hubFor);
      for (const h of n.parents) h.kids.push(n);
      if (n.x == null) place(n, n.parents[0]);
    }
    s.userCam = false;
    s.dirty = true;
    s.heat = Math.max(s.heat, heat);
    setTerms(countTerms(items.map((n) => n.entry), v.sel)); // so each pick narrows the result
    setHits(items.length);
  }

  function changeView(patch) {
    const v = { ...viewRef.current, ...patch };
    viewRef.current = v;
    setView(v);
    try { sessionStorage.setItem(FILTERS, JSON.stringify(v)); } catch {}
    rebuild(1, v);
  }
  // Filtering switches the Color view to Tags; clearing every filter switches back.
  function setSelected(sel) {
    const v = viewRef.current;
    const by = sel.length && v.by === "Color" ? "Tags" : !sel.length && v.auto ? "Color" : v.by;
    changeView({ sel, by, auto: by === v.by ? v.auto : by === "Tags" });
  }
  const addTerm = (t) => {
    if (!t || viewRef.current.sel.includes(t)) return;
    setSelected([...viewRef.current.sel, t]);
    setQuery(""); setActive(0); setSuggestOpen(false);
  };
  const toggleTerm = (t) => (view.sel.includes(t) ? setSelected(view.sel.filter((x) => x !== t)) : addTerm(t));

  // ---------- library ----------
  // New entries get a node; known ones pick up new analysis results.
  function merge(items) {
    const s = g.current;
    let changed = false;
    for (const e of items) {
      const n = s.byId.get(e.id);
      if (!n) {
        const node = { id: e.id, hub: false, entry: e };
        s.byId.set(e.id, node);
        loadThumb(node, [e.thumb, e.image], () => { s.dirty = true; });
        changed = true;
      } else {
        if (n.entry.tags.join() !== e.tags.join() || keysOf(n.entry).join() !== keysOf(e).join()) changed = true;
        n.entry = e;
        if (detailRef.current?.id === e.id) setDetail(e); // keep the open panel current
      }
    }
    if (changed) rebuild(0.3); // background updates nudge the layout, not reshuffle it
    setCount(s.byId.size);
  }

  useEffect(() => {
    const s = g.current;
    // Settings are remembered per browser; filters per tab.
    setTune({ ...DEFAULTS, ...readJSON(localStorage, STORE) });
    setShowTuning(new URLSearchParams(location.search).has("tune"));
    if (matchMedia("(max-width: 640px)").matches) { setPanelOpen(false); panelWas.current = false; } // phones: keep the map visible
    const saved = readJSON(sessionStorage, FILTERS);
    if (saved && GROUP_BY[saved.by] && Array.isArray(saved.sel)) { viewRef.current = saved; setView(saved); }
    else openLastProject();

    if (s.byId.size) { // back from another page: the kept layout as it was
      const userCam = s.userCam;
      Object.assign(s, { mouse: null, hover: null, dragged: null });
      rebuild(0);
      s.userCam = userCam;
      setZoom(s.cam.k); setCount(s.byId.size);
    }
    const load = () => fetchLibrary(s.etag)
      .then((d) => { if (!d) return; s.etag = d.etag; setOnline(d.online); merge(d.items); })
      .catch(() => setOnline(false));
    load();
    const t = setInterval(load, POLL_MS);
    return () => { clearInterval(t); kept = s; };
  }, []);

  // First open in this tab: start on the most recently used project's references.
  function openLastProject() {
    fetch("/api/projects").then((r) => r.json()).then((list) => {
      const last = list.filter((p) => p.refs > 0).sort((a, b) => b.updated.localeCompare(a.updated))[0];
      return last && fetch(`/api/projects/${last.id}`).then((r) => r.json());
    }).then((p) => {
      if (p?.refs?.length && !viewRef.current.proj) changeView({ proj: { id: p.id, name: p.name, refs: p.refs } });
    }).catch(() => {});
  }

  function setParam(key, value) {
    const next = { ...tune, [key]: value };
    setTune(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  }
  function resetLayout() {
    setTune(DEFAULTS);
    try { localStorage.removeItem(STORE); } catch {}
    const s = g.current;
    for (const n of [...s.byId.values(), ...s.hubCache.values()]) n.pinned = false;
    s.heat = 1;
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
  const closeRef = useRef(closeDetail); closeRef.current = closeDetail;

  // ---------- canvas loop: layout, camera, draw only when something changed ----------
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext("2d"), s = g.current;
    const css = getComputedStyle(document.documentElement), colors = {};
    const color = (v) => (colors[v] ??= css.getPropertyValue(v).trim());
    const phone = () => canvas.clientWidth <= 640;
    const hubR = (h) => (h.rep?.img ? tuneRef.current.dot * HUB_DOTS : 6);
    const pos = (n) => toScreen(s.cam, canvas, n);
    const hubAt = (m) => m && s.nodes.findLast((n) => n.hub && Math.hypot(pos(n).x - m.x, pos(n).y - m.y) <= Math.max(hubR(n), 10));
    // Hub circles keep a screen-px gap; the zoom used is floored so it can't feed back into fitting
    // (wider gap -> zoom out -> wider gap). Far out, many hubs may overlap a little.
    const hubGap = (a, b) => (hubR(a) + hubR(b) + 36) / Math.max(s.cam.k, phone() ? 0.03 : 0.08);

    let raf;
    const frame = () => {
      const start = performance.now(), settings = { spread: tuneRef.current.spread, hubGap };
      let moving = step(s, settings);
      while (moving && !s.dragged && performance.now() - start < LAYOUT_MS) step(s, settings);

      let fitted = false;
      if (!s.userCam && s.nodes.length) { // keep every dot in view until the user zooms or drags
        const before = s.cam;
        s.cam = fitStep(s.cam, canvas, s.nodes, {
          pad: 120 + 2 * tuneRef.current.dot * HUB_DOTS,
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
      <canvas ref={canvasRef} className="graph" />
      <div className="side">
        <div className="tag-search glass">
          <p className="tag-status">
            {!online ? "AI analyser is off — open axia-prototype/Axia-실행-Mac.command"
              : view.sel.length || view.proj ? `${hits} of ${count} references` : `${count} references · ${terms.length} terms`}
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
          {(view.sel.length > 0 || view.proj) && (
            <div className="tag-chips">
              {view.proj && (
                <button type="button" className="chip on" aria-label={`Show all references, not only ${view.proj.name}`} title="Show all references"
                  onClick={() => changeView({ proj: null })}>Project: {view.proj.name}<span className="chip-x" aria-hidden="true">×</span></button>
              )}
              {view.sel.map((t) => (
                <button key={t} type="button" className="chip on" aria-label={`Remove ${t} filter`} title="Remove"
                  onClick={() => setSelected(view.sel.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>
              ))}
              {view.sel.length > 1 && <button type="button" className="btn" onClick={() => setSelected([])}>Clear all</button>}
            </div>
          )}
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
          <div className="segmented" role="group" aria-label="Group the map by">
            {Object.keys(GROUP_BY).map((by) => (
              <button key={by} type="button" aria-pressed={by === view.by} onClick={() => changeView({ by, auto: false })}>{by}</button>
            ))}
          </div>
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
          <h1>Nothing here yet</h1>
          <p>Send references with the Chrome extension (“Send to AxiA”) or add links and files in Library. They show up here once analysed.</p>
          <Link href="/library" className="btn primary">Open Library</Link>
        </div>
      )}
    </div>
  );
}
