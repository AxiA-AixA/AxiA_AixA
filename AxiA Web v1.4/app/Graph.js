"use client";

// The reference map, seen through a lens: Default (the AxiA symbol image, public/brand/AxiA_Symbol_500.png)
// or a project. The lens sits in the centre, its tags in a ring around it, and the references with
// those tags (as if they were filters) linked to them. Clicking a tag shows its references in the grid.
// The map takes the whole window; its tools sit in the header row, a clicked reference opens large on
// the right, over the map. This file holds the React side: what is shown (filters, map or grid) and panels.
// The rest lives in small modules:
//   lib/graph/terms.js   grouping, search terms, suggestions (pure)
//   lib/graph/layout.js  force layout with a quadtree (pure)
//   lib/graph/thumbs.js  image loading into small decoded thumbnails
//   app/graph/camera.js  world <-> screen, zoom, fit
//   app/graph/draw.js    canvas drawing
//   app/graph/input.js   mouse, wheel and touch

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KIND, countTerms, passes, suggest, termsOf } from "@/lib/graph/terms";
import { lensTags } from "@/lib/spec";
import { place, step } from "@/lib/graph/layout";
import { loadThumb } from "@/lib/graph/thumbs";
import { fetchLibrary } from "@/lib/client/library";
import { camMoved, fitStep, toScreen } from "./graph/camera";
import { drawMap } from "./graph/draw";
import { attachInput } from "./graph/input";
import RefGrid from "./shared/RefGrid";
import { changeTags } from "./shared/tags";
import { ChevronIcon, GridIcon, MapIcon, SettingsIcon } from "./shell/icons";
import RefDetail from "./shared/RefDetail";
import HeadTools from "./shell/HeadTools";

// Display settings (the sliders under Display).
const TUNING = [
  { key: "spread", label: "Spread (dot repulsion)", min: 20, max: 600, step: 10, value: 400 },
  { key: "dot", label: "Image size", min: 6, max: 120, step: 1, value: 15 },
  { key: "showAt", label: "Image shows from radius (px)", min: 3, max: 40, step: 1, value: 5 },
  { key: "lens", label: "Lens reach (px)", min: 40, max: 400, step: 10, value: 220 },
  { key: "lensGain", label: "Lens strength", min: 0, max: 2, step: 0.05, value: 0.15 },
  { key: "hover", label: "Hover size (px)", min: 20, max: 200, step: 2, value: 64 },
  { key: "corner", label: "Corner radius (px)", min: 0, max: 30, step: 1, value: 8 },
];
const DEFAULTS = Object.fromEntries(TUNING.map((t) => [t.key, t.value]));
// The symbol image's library id (sha1 of public/brand/AxiA_Symbol_500.png). Its tags make the ring.
const SYMBOL_ID = "95fc3d268585a41a";
const GRID_MAX = 300; // grid cards at most (the closest first)
const ENOUGH = 10;     // references a lens should show; fewer: ask for one tag fewer
const POLL_MS = 5000;    // library refresh, so new analysis results move in live
const LAYOUT_MS = 8;     // layout time per frame
const STORE = "axia-tuning-symbol-3"; // new name: the old big-library settings don't carry over
const FILTERS = "axia-map-view"; // searched terms + map/grid, kept for this browser tab

// The map state lives outside React (it changes every frame) and is kept while visiting other
// pages, so coming back shows the same layout. Reset on reload.
let kept = null;
const freshState = () => ({
  nodes: [], byId: new Map(), tagHubs: new Map(), etag: null,
  cam: { x: 0, y: 0, k: 1 }, shownK: 1, heat: 0, mouse: null, hover: null, dragged: null, userCam: false, dirty: true,
});
const readJSON = (store, key) => { try { return JSON.parse(store.getItem(key) ?? "null"); } catch { return null; } };

// lens: a project id (/map?lens=…) to see the map through that project; none: the AxiA symbol.
export default function Graph({ lens }) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const g = useRef(kept ?? freshState());
  const [count, setCount] = useState(0);         // references in the library
  const [online, setOnline] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [tune, setTune] = useState(DEFAULTS);
  const [panelOpen, setPanelOpen] = useState(false); // the Display settings, opened with ⚙
  // What is shown: sel = searched terms; mode = "map" or "grid".
  const [view, setView] = useState({ sel: [], mode: "map" });
  const [shownEntries, setShownEntries] = useState([]); // for the grid view
  const [terms, setTerms] = useState([]);        // [[term, count]] among shown images
  const [hits, setHits] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState(null);    // clicked image, shown in the side panel
  const [lensInfo, setLensInfo] = useState({ name: "Default", tags: [], need: 0 });
  const [lensOpen, setLensOpen] = useState(false); // the "Viewing" list
  const [recent, setRecent] = useState([]);        // recent projects, for that list
  const dockRef = useRef(null);
  const projRef = useRef(null);
  const tagsRef = useRef([]);                    // the ring's tags now (see rebuild)                  // the lens project ({ name, word, refs, edits }), or null

  // The canvas loop reads these without re-subscribing.
  const viewRef = useRef(view); viewRef.current = view;
  const tuneRef = useRef(tune); tuneRef.current = tune;
  const detailRef = useRef(detail); detailRef.current = detail;
  g.current.dirty = true; // any re-render (settings, filters, panels) redraws once

  // ---------- what is shown ----------
  // Recompute the shown nodes and their links; `heat` lets the layout move again.
  // The lens is what the map is seen through: the AxiA symbol reference and its tags, or a project
  // (in the centre, linked to its tags: the client's words and the spec's points that are on).
  function rebuild(heat = 1, v = viewRef.current) {
    const s = g.current;
    const proj = projRef.current;
    const sym = s.byId.get(SYMBOL_ID);
    const projRefs = proj ? proj.refs.map((id) => s.byId.get(id)).filter(Boolean) : [];
    // Which tags make the ring:
    //   a project: its tags (client's words and spec points), which you can take out or add to (view.lensTags);
    //   Default, searching: only the searched tags, over the whole library, no centre;
    //   Default: the AxiA symbol's tags around the symbol.
    const searching = !proj && v.sel.length > 0;
    const tags = proj ? v.lensTags ?? lensTags(proj, projRefs.map((n) => n.entry)) : searching ? v.sel : sym?.entry.tags ?? [];
    tagsRef.current = tags;
    const centre = proj ? (s.projNode ??= { hub: true, center: true }) : searching ? null : sym;
    if (centre) thumb(proj ? projRefs[0] ?? centre : sym); // first in the image queue
    const hubs = tags.map((t) => {
      if (!s.tagHubs.has(t)) s.tagHubs.set(t, { id: t, hub: true, vx: 0, vy: 0, pinned: true });
      return Object.assign(s.tagHubs.get(t), { kids: [] });
    });
    // Searching (Default): every reference with all the searched terms. Otherwise the references with
    // every one of the ring's tags; fewer than ENOUGH: one tag fewer at a time (a project's tags rarely
    // all meet in one image). A searched term in a project narrows that further (passes).
    const has = (n) => { const t = new Set(termsOf(n.entry).map((x) => x.toLowerCase())); return hubs.filter((h) => t.has(h.id.toLowerCase())); };
    const cand = [];
    for (const n of s.byId.values()) {
      if (n === centre || !passes(n.entry, v.sel)) continue;
      n.parents = has(n);
      if (n.parents.length) cand.push(n);
    }
    let need = hubs.length;
    if (searching) need = 1; // passes() already asked for every searched term
    else while (need > 1 && cand.filter((n) => n.parents.length >= need).length < ENOUGH) need--;
    const shown = hubs.length ? cand.filter((n) => n.parents.length >= need) : [];
    shown.sort((a, b) => b.parents.length - a.parents.length);
    for (const n of shown) { for (const h of n.parents) h.kids.push(n); thumb(n); }
    // The tags stay in an even ring around the centre, first one at the top, the ring as wide as the
    // cloud of references gets (drag a tag to move it until the next change).
    const R = Math.max(300, 60 * Math.sqrt(shown.length));
    hubs.forEach((h, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / hubs.length;
      Object.assign(h, { x: R * Math.cos(a), y: R * Math.sin(a) });
    });
    for (const n of shown) if (n.x == null || Number.isNaN(n.x)) place(n, n.parents[0]); // new: next to a tag
    if (sym) sym.pinned = false; // a reference like any other, unless it is the centre
    if (centre) { // the centre stays put, a line to each of its tags
      Object.assign(centre, { parents: hubs, x: 0, y: 0, vx: 0, vy: 0, pinned: true });
      if (proj) Object.assign(centre, { id: proj.name, kids: projRefs });
    }
    s.nodes = [...shown, ...hubs, ...(centre ? [centre] : [])];
    s.userCam = false;
    s.dirty = true;
    s.heat = Math.max(s.heat, heat);
    setLensInfo({ name: proj ? proj.name : "Default", tags, need });
    // Grid: the same references, the ones with most of the tags first.
    const pool = shown.map((n) => n.entry);
    // Suggestions are tags only (no sites or types): from the whole library until something is searched,
    // then from what that found (so each pick narrows the result).
    const from = searching ? pool : [...s.byId.values()].map((n) => n.entry);
    setTerms(countTerms(from, [...v.sel, ...(proj ? tags : [])]).filter(([t]) => !KIND.has(t)));
    setHits(pool.length);
    setShownEntries(pool.slice(0, GRID_MAX));
  }
  // Load a node's thumbnail once.
  function thumb(n) {
    if (n.loading) return;
    n.loading = true;
    if (n.entry) loadThumb(n, [n.entry.thumb, n.entry.image], () => { g.current.dirty = true; });
  }
  // A tag shows its references in the grid; a project in the centre opens the project.
  const openTag = (hub) => (hub.center ? router.push(`/project/${projRef.current.id}`)
    : changeView(viewRef.current.sel.includes(hub.id) ? { mode: "grid" } : { sel: [hub.id], mode: "grid" }));

  function changeView(patch) {
    const v = { ...viewRef.current, ...patch };
    viewRef.current = v;
    setView(v);
    try { sessionStorage.setItem(FILTERS, JSON.stringify(v)); } catch {}
    rebuild(1, v);
  }
  const setSelected = (sel) => changeView({ sel });
  // In a project, searching adds to its tags; × on a chip takes one out; Reset brings back the project's own.
  const setLensTags = (lensTags) => changeView({ lensTags });
  const addTerm = (t) => {
    if (t && projRef.current) {
      if (!tagsRef.current.includes(t)) setLensTags([...tagsRef.current, t]);
      setQuery(""); setActive(0); setSuggestOpen(false);
      return;
    }
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
    if (changed) rebuild(0.6);
    setCount(s.byId.size);
  }

  useEffect(() => {
    const s = g.current;
    // Settings are remembered per browser; the view per tab.
    setTune({ ...DEFAULTS, ...readJSON(localStorage, STORE) });
    const saved = readJSON(sessionStorage, FILTERS);
    if (saved && Array.isArray(saved.sel)) { viewRef.current = { ...viewRef.current, sel: saved.sel, mode: saved.mode === "grid" ? "grid" : "map" }; setView(viewRef.current); }

    if (s.byId.size) { // back from another page: the kept layout as it was
      const userCam = s.userCam;
      Object.assign(s, { mouse: null, hover: null, dragged: null });
      rebuild(0);
      s.userCam = userCam;
      setZoom(s.cam.k); setCount(s.byId.size);
    }
    const load = () => fetchLibrary(s.etag)
      .then((d) => { if (d) { s.etag = d.etag; setOnline(d.online); merge(d.items); } })
      .catch(() => setOnline(false));
    loadRef.current = () => { s.etag = null; load(); };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { clearInterval(t); kept = s; };
  }, []);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json())
      .then((list) => setRecent([...list].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 8)))
      .catch(() => {});
  }, []);

  // The lens project: read it whenever the lens changes (the sidebar's "Viewing" list sets ?lens=).
  useEffect(() => {
    let gone = false;
    const show = (p) => {
      if (gone) return;
      projRef.current = p;
      const v = { ...viewRef.current, sel: [], lensTags: null }; // a new lens starts from its own tags
      viewRef.current = v; setView(v);
      rebuild(1, v);
    };
    if (!lens) show(null);
    else fetch(`/api/projects/${lens}`).then((r) => (r.ok ? r.json() : null)).then(show).catch(() => show(null));
    return () => { gone = true; };
  }, [lens]);

  function setParam(key, value) {
    const next = { ...tune, [key]: value };
    setTune(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  }
  function resetLayout() {
    setTune(DEFAULTS);
    try { localStorage.removeItem(STORE); } catch {}
    tuneRef.current = DEFAULTS;
    const s = g.current;
    for (const n of s.byId.values()) if (n.id !== SYMBOL_ID) n.pinned = false;
    rebuild(1);
  }

  // Opening an image: the panel covers the right of the window, so move the map (not refit it) until
  // the clicked dot sits in the middle of what's left.
  function openDetail(e) {
    setDetail(e);
    const s = g.current, n = s.byId.get(e.id), canvas = canvasRef.current;
    if (!n || n.x == null || viewRef.current.mode === "grid" || !canvas) return;
    const panel = Math.max(280, Math.min(Math.min(480, Math.max(320, innerWidth * 0.3)), (innerWidth - 640) / 2 - 24)); // .stage .inspector in shell.css
    const free = canvas.clientWidth - (panel + 24);
    const p = toScreen(s.cam, canvas, n);
    if (p.x < free - 40) return;
    s.cam = { ...s.cam, x: s.cam.x + (p.x - free / 2) / s.cam.k };
    s.userCam = true; s.dirty = true;
  }
  const closeDetail = () => setDetail(null);
  const openRef = useRef(openDetail); openRef.current = openDetail;
  const tagRef = useRef(openTag); tagRef.current = openTag;
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
    // What covers the map: the header row on top, the dock (and the chosen tags) at the bottom. (The
    // image panel opens over the map without refitting it; see openDetail.)
    const covered = () => ({
      side: 0, top: document.querySelector(".app-head")?.getBoundingClientRect().bottom ?? 0,
      bottom: dockRef.current ? canvas.clientHeight - dockRef.current.getBoundingClientRect().top : 0,
    });    const hubR = () => Math.max(14, Math.min(26, 20 * s.cam.k)); // tag circles, px
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
          ...covered(), // where the panels cover the map
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

    const detach = attachInput(canvas, s, { hubAt, onOpen: (e) => openRef.current(e), onHub: (h) => tagRef.current(h), onEmpty: () => closeRef.current(), onZoom: setZoom });
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
    } else if (e.key === "Backspace" && !query && projRef.current && !view.sel.length && lensInfo.tags.length) {
      setLensTags(lensInfo.tags.slice(0, -1));
    } else if (e.key === "Backspace" && !query && view.sel.length) {
      setSelected(view.sel.slice(0, -1)); // like a token field
    }
  }

  const symbol = g.current.byId.get(SYMBOL_ID)?.entry;
  const countLine = !online ? "AI analyser is off — open axia-prototype/Axia-실행-Mac.command"
    : view.sel.length ? `${hits} of ${count} references`
    : !lensInfo.tags.length ? `${lensInfo.name} has no tags yet`
    : lensInfo.need === lensInfo.tags.length ? `${hits} references have all ${lensInfo.tags.length} of these tags`
    : `${hits} references have ${lensInfo.need} or more of these ${lensInfo.tags.length} tags`;
  const project = projRef.current;

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="graph" style={view.mode === "grid" ? { display: "none" } : undefined} />
      {view.mode === "grid" && (
        <div className="map-grid">
          <RefGrid items={shownEntries} onOpen={openDetail} onTags={tagEntry} terms={terms}
            empty="No references match. Remove a filter to see more." />
        </div>
      )}

      {/* In the header row: map or grid, display settings */}
      <HeadTools>
        <span className="head-spacer" />
        <div className="view-switch glass" role="group" aria-label="View">
          <button type="button" aria-pressed={view.mode !== "grid"} onClick={() => changeView({ mode: "map" })}><MapIcon />Map</button>
          <button type="button" aria-pressed={view.mode === "grid"} onClick={() => changeView({ mode: "grid" })}><GridIcon />Grid</button>
        </div>
        <div className="tune-pick">
          <button type="button" className="tool glass icon" aria-label="Display settings" title="Display settings" aria-pressed={panelOpen}
            onClick={() => setPanelOpen(!panelOpen)}><SettingsIcon /></button>
          {panelOpen && (
            <section className="tuning pop" aria-label="Display settings">
              <h2>Display <span>· zoom {zoom.toFixed(2)}</span></h2>
              {TUNING.map((p) => (
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
            </section>
          )}
        </div>
      </HeadTools>

      {/* Bottom centre, over the map: what it's seen through and the tag filter; the chosen tags above */}
      <div className="map-dock" ref={dockRef}>
        {(project || view.sel.length > 0) && (
          <div className="tag-chips">
            {project && lensInfo.tags.map((t) => (
              <button key={`p-${t}`} type="button" className="chip on" aria-label={`Take ${t} out of ${project.name}'s tags`} title="Take out"
                onClick={() => setLensTags(lensInfo.tags.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>
            ))}
            {project && view.lensTags && <button type="button" className="btn" onClick={() => setLensTags(null)}>Reset to {project.name}’s tags</button>}
            {project && view.sel.length > 0 && <span className="muted">Filter:</span>}
            {view.sel.map((t) => (
              <button key={t} type="button" className="chip on" aria-label={`Remove ${t} filter`} title="Remove"
                onClick={() => setSelected(view.sel.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>
            ))}
            {view.sel.length > 1 && <button type="button" className="btn" onClick={() => setSelected([])}>Clear all</button>}
            <span className="muted">{countLine}</span>
          </div>
        )}
        <div className="dock-bar glass">
          <details className="lens-pick" open={lensOpen} onToggle={(e) => setLensOpen(e.currentTarget.open)}>
            <summary className="tool" title="What the map is seen through"><span className="muted">Viewing</span> {project?.name ?? "Default"}<ChevronIcon /></summary>
            <div className="pop">
              <Link href="/map" className="pop-item" aria-current={!lens ? "true" : undefined} onClick={() => setLensOpen(false)}>Default <span className="muted">AxiA symbol</span></Link>
              {recent.length > 0 && <p className="pop-label">Recent projects</p>}
              {recent.map((p) => (
                <div key={p.id} className="pop-row">
                  <Link href={`/map?lens=${p.id}`} className="pop-item" aria-current={lens === p.id ? "true" : undefined} onClick={() => setLensOpen(false)}>{p.name}</Link>
                  <Link href={`/project/${p.id}`} className="pop-open" title={`Open ${p.name}`}>Open ↗</Link>
                </div>
              ))}
            </div>
          </details>
          <form className="tool-search" onSubmit={(e) => { e.preventDefault(); if (showSuggest) addTerm(suggestions[active]?.[0]); }} role="search">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input id="page-search" value={query} placeholder={project ? "Add a tag" : view.sel.length ? "Add another tag" : "Search tags"}
              aria-label="Filter by tag" role="combobox" aria-autocomplete="list" aria-expanded={showSuggest}
              aria-controls="tag-suggest" aria-activedescendant={showSuggest ? `tag-suggest-${active}` : undefined}
              onChange={(e) => { setQuery(e.target.value); setActive(0); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)} onClick={() => setSuggestOpen(true)}
              onBlur={() => setSuggestOpen(false)} onKeyDown={onSearchKey} />
            <span className="keys" aria-hidden="true"><kbd>⌘</kbd><kbd>K</kbd></span>
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
        </div>
      </div>

      {/* The clicked reference, large, over the map (only while one is open) */}
      {detail && (
        <aside className="inspector" aria-label="Selected reference">
          <RefDetail entry={detail} onClose={closeDetail} isOn={(t) => view.sel.includes(t)} onTag={toggleTerm} />
        </aside>
      )}

      {!lens && count > 0 && !symbol && online && (
        <div className="empty">
          <h1>The AxiA symbol isn’t in the library</h1>
          <p>The map shows the AxiA symbol’s tags. Add public/brand/AxiA_Symbol_500.png in Library and it appears here once analysed.</p>
          <Link href="/library" className="btn primary">Open Library</Link>
        </div>
      )}
    </div>
  );
}
