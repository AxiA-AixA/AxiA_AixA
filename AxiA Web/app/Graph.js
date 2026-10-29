"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hostOf } from "@/lib/links";

// Display values, tunable from the panel under the header. Find good ones, then
// bake them in as the defaults here.
const TUNING = [
  { key: "spread", label: "Spread (dot repulsion)", min: 20, max: 600, step: 10, value: 400 },
  { key: "dot", label: "Dot size", min: 2, max: 12, step: 0.5, value: 12 },
  { key: "showAt", label: "Image shows from radius (px)", min: 3, max: 40, step: 1, value: 5 },
  { key: "lens", label: "Lens reach (px)", min: 40, max: 400, step: 10, value: 400 },
  { key: "lensGain", label: "Lens strength", min: 0, max: 8, step: 0.1, value: 5 },
  { key: "hover", label: "Hover size (px)", min: 20, max: 160, step: 2, value: 60 },
  { key: "corner", label: "Corner radius when large (px)", min: 0, max: 30, step: 1, value: 10 },
];
const HUB_DOTS = 2; // hub thumbnail circle = this × "Dot size" (radius, screen px)
const SIDE_W = 340;    // width of the right-hand panel column (matches .side in globals.css)
const DEFAULTS = Object.fromEntries(TUNING.map((t) => [t.key, t.value]));
const STORE = "axia-tuning";
const FILTERS = "axia-filters"; // searched tags + view, kept for this browser tab

// Project types (axia-prototype's "field" codes) as shown on the graph.
const FIELD_NAMES = {
  "3d": "3D", graphic: "Graphic", photo: "Photo", architecture: "Architecture", typography: "Typography",
  painting: "Painting", package: "Package", video: "Video", ui_ux: "UI/UX", editorial: "Editorial", ai_image: "AI Image",
};
const fieldNames = (e) => (e.fields.length ? e.fields.map((f) => FIELD_NAMES[f] ?? f) : [e.status === "tagged" ? "Other" : "Analysing"]);

// What the hubs are. An image links to every hub it belongs to, so one that is e.g. both
// Graphic and Package sits between those two. Type (default) = project types, Tags = style tags.
const GROUP_BY = {
  Type: fieldNames,
  Tags: (e) => (e.tags.length ? e.tags : ["Untagged"]),
  Group: (e) => [e.group_name || "untagged"],
  Platform: (e) => [e.url ? platformOf(e.url) : "file"],
};
// Searchable terms of an image: its style tags, plus its project types, group name and platform,
// so those can be searched and filtered on like tags. KIND remembers which non-tag kind a term is.
const KIND = new Map();
// "kr.pinterest.com", "uk.pinterest.com" -> "pinterest.com" (country subdomains are one platform)
const platformOf = (url) => hostOf(url).replace(/^[a-z]{2}\./, "");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function termsOf(e) {
  if (e._terms) return e._terms;
  const terms = [...e.tags];
  const add = (term, kind) => {
    if (!term || terms.includes(term)) return;
    terms.push(term);
    if (!KIND.has(term)) KIND.set(term, kind);
  };
  for (const f of e.fields) add(FIELD_NAMES[f] ?? f, "Type");
  add(e.group_name && cap(e.group_name), "Group");
  if (e.url) add(platformOf(e.url), "Platform");
  return (e._terms = terms);
}
// Searched terms act as filters: an image shows only if it has every one of them.
const passes = (e, selected) => selected.every((t) => termsOf(e).includes(t));

export default function Graph() {
  const canvasRef = useRef(null);
  const g = useRef({ nodes: [], byId: new Map(), hubs: new Map(), hubCache: new Map(), cam: { x: 0, y: 0, k: 1 }, shownK: 1, mouse: null, hover: null, userCam: false });
  const [stats, setStats] = useState({ links: 0, thumbs: 0 });
  const [online, setOnline] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [tune, setTune] = useState(DEFAULTS);
  const [groupBy, setGroupBy] = useState("Type");
  const groupRef = useRef(groupBy);
  const autoTags = useRef(false); // Tags view was picked by a filter, not by the user
  const [tags, setTags] = useState([]); // [[tag, count]] among shown images, for suggestions
  const [query, setQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(0); // highlighted suggestion
  const [selected, setSel] = useState([]);
  const selRef = useRef(selected);
  const [hits, setHits] = useState(0);
  const [detail, setDetail] = useState(null); // clicked image, shown in the right half
  const detailRef = useRef(null);
  const [tuningOpen, setTuningOpen] = useState(true);
  const tuningWas = useRef(true); // Display folds while an image is open, then comes back as it was
  const tuningOpenRef = useRef(true);
  tuningOpenRef.current = tuningOpen;
  const tuneRef = useRef(tune);
  tuneRef.current = tune;

  // Slider values are remembered per browser so tuning survives a reload.
  useEffect(() => {
    try { setTune({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") }); } catch {}
    // Filters come back after visiting another page (runs before the first library load).
    try {
      const f = JSON.parse(sessionStorage.getItem(FILTERS) ?? "null");
      if (f && GROUP_BY[f.by] && Array.isArray(f.sel)) {
        selRef.current = f.sel; setSel(f.sel); groupRef.current = f.by; setGroupBy(f.by); autoTags.current = !!f.auto;
      }
    } catch {}
  }, []);
  function saveFilters() {
    try { sessionStorage.setItem(FILTERS, JSON.stringify({ sel: selRef.current, by: groupRef.current, auto: autoTags.current })); } catch {}
  }
  function setParam(key, value) {
    const next = { ...tune, [key]: value };
    setTune(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  }

  // The graph shows axia-prototype's library only. Polled, so new analysis results move in live.
  useEffect(() => {
    const load = () => fetch("/api/library").then((r) => r.json()).then((d) => { setOnline(d.online); show(d.items); }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  // Add new library items; for known ones pick up new analysis results.
  function show(items) {
    const s = g.current;
    let changed = false;
    for (const e of items) {
      const n = s.byId.get(e.id);
      if (!n) {
        const node = { id: e.id, hub: false, entry: e };
        s.byId.set(e.id, node);
        loadImage(node, e.image);
        changed = true;
      } else {
        if (termsOf(n.entry).join() !== termsOf(e).join() || keysOf(n.entry).join() !== keysOf(e).join()) changed = true;
        n.entry = e;
        if (detailRef.current?.id === e.id) { detailRef.current = e; setDetail(e); } // keep the open panel current
      }
    }
    if (changed) rebuild(0.3); // background updates nudge the layout, not reshuffle it
    setStats((v) => ({ ...v, links: s.byId.size }));
  }

  // With tags searched, the Tags view shows only those tags' hubs.
  function keysOf(e) {
    const sel = selRef.current;
    return groupRef.current === "Tags" && sel.length ? sel : GROUP_BY[groupRef.current](e);
  }

  function place(n, near) {
    const p = near ?? { x: 0, y: 0 };
    return Object.assign(n, { x: p.x + (Math.random() - 0.5) * 80, y: p.y + (Math.random() - 0.5) * 80, vx: 0, vy: 0 });
  }

  // Hubs are reused across rebuilds so they keep their place.
  function hubFor(key) {
    const s = g.current;
    if (!s.hubs.has(key)) {
      const h = s.hubCache.get(key) ?? place({ id: key, hub: true });
      h.kids = []; // its images; the first one with a loaded thumbnail stands for the hub
      s.hubCache.set(key, h);
      s.hubs.set(key, h);
      s.nodes.push(h);
    }
    return s.hubs.get(key);
  }

  // Recompute what is shown: filter by searched tags, then link each image to its hubs.
  function rebuild(heat = 1) {
    const s = g.current, sel = selRef.current;
    const items = [...s.byId.values()].filter((n) => passes(n.entry, sel));
    s.nodes = [...items];
    s.hubs.clear();
    for (const n of items) {
      n.parents = keysOf(n.entry).map(hubFor);
      for (const h of n.parents) h.kids.push(n);
      if (n.x == null) place(n, n.parents[0]);
    }
    s.userCam = false;
    s.heat = Math.max(s.heat ?? 0, heat); // let the layout move again
    const count = {}; // suggest tags of the shown images, so each pick narrows the result
    for (const n of items) for (const t of termsOf(n.entry)) if (!sel.includes(t)) count[t] = (count[t] ?? 0) + 1;
    setTags(Object.entries(count).sort((a, b) => b[1] - a[1]));
    setHits(items.length);
  }
  function unpinAll() {
    const s = g.current;
    for (const n of [...s.byId.values(), ...s.hubCache.values()]) n.pinned = false;
    s.heat = 1;
  }
  function regroup(by) { autoTags.current = false; groupRef.current = by; setGroupBy(by); saveFilters(); rebuild(); }
  function setSelected(next) {
    selRef.current = next; setSel(next);
    // Filtering switches the default Type view to Tags; clearing all filters switches back.
    const by = next.length && groupRef.current === "Type" ? "Tags" : !next.length && autoTags.current ? "Type" : null;
    if (by) { autoTags.current = by === "Tags"; groupRef.current = by; setGroupBy(by); }
    saveFilters();
    rebuild();
  }

  // Suggestions while typing: tags containing the text, those starting with it first, then by use.
  // `tags` only holds tags of the images still shown, so once filters are set these are the related
  // tags (picking one always narrows the result, never empties it). Empty field: most used first.
  const q = query.trim().toLowerCase();
  const suggestions = (q
    ? tags.filter(([t]) => t.toLowerCase().includes(q))
        .sort((a, b) => b[0].toLowerCase().startsWith(q) - a[0].toLowerCase().startsWith(q) || b[1] - a[1])
    : tags).slice(0, 8);
  const showSuggest = suggestOpen && suggestions.length > 0;

  function addTag(t) {
    if (!t || selRef.current.includes(t)) return;
    setSelected([...selRef.current, t]);
    setQuery("");
    setActive(0);
    setSuggestOpen(false); // don't cover the chips; typing, ↓ or a click reopens it
  }
  function onSearchKey(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestOpen(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + suggestions.length) % Math.max(1, suggestions.length));
    } else if (e.key === "Escape") {
      e.stopPropagation(); // close the list, not the detail panel
      setSuggestOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length) {
      setSelected(selected.slice(0, -1)); // like a token field: backspace removes the last filter
    }
  }

  function openDetail(e) {
    if (!detailRef.current) { tuningWas.current = tuningOpenRef.current; setTuningOpen(false); }
    detailRef.current = e; setDetail(e); g.current.userCam = false;
  }
  function closeDetail() {
    if (detailRef.current) setTuningOpen(tuningWas.current);
    detailRef.current = null; setDetail(null); g.current.userCam = false;
  }

  function loadImage(node, src) {
    const img = new Image();
    img.onload = () => { node.img = img; setStats((v) => ({ ...v, thumbs: v.thumbs + 1 })); };
    img.src = src;
  }

  // Simulation + drawing loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const s = g.current;
    const css = getComputedStyle(document.documentElement);
    const color = (v) => css.getPropertyValue(v).trim();
    let raf;

    // Hubs show a representative thumbnail in a circle 4× the dot size (a small dot until one has loaded).
    const hubImg = (h) => h.rep?.img;
    // Pick each hub's thumbnail: its first loaded image that no other hub is already showing.
    const pickReps = () => {
      const used = new Set();
      for (const h of s.nodes) {
        if (!h.hub) continue;
        h.rep = h.kids?.find((k) => k.img && !used.has(k)) ?? h.kids?.find((k) => k.img);
        if (h.rep) used.add(h.rep);
      }
    };
    const hubR = (h) => (hubImg(h) ? tuneRef.current.dot * HUB_DOTS : 6);
    const hubAt = (m) => m && s.nodes.findLast((n) => {
      if (!n.hub) return false;
      const p = toScreen(n);
      return Math.hypot(p.x - m.x, p.y - m.y) <= Math.max(hubR(n), 10);
    });

    const toScreen = (n) => ({
      x: (n.x - s.cam.x) * s.cam.k + canvas.clientWidth / 2,
      y: (n.y - s.cam.y) * s.cam.k + canvas.clientHeight / 2,
    });

    // The layout cools down and stops once settled; rebuild() heats it up again.
    function step() {
      if (!(s.heat > 0.02)) return;
      s.heat *= 0.99;
      const { nodes } = s;
      // ponytail: O(n²) repulsion, fine to ~1,000 dots; use a quadtree (Barnes–Hut) beyond that.
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 0.01;
          const f = (a.hub && b.hub ? 6000 : tuneRef.current.spread) / d2;
          a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
          if (a.hub && b.hub) { // keep hub thumbnails (screen size) from overlapping
            // ponytail: gap is in screen px, capped at zoom 0.08 so it can't feed back into fit()
            // (wider gap -> zoom out -> wider gap); many hubs may overlap a little when zoomed far out.
            const min = (hubR(a) + hubR(b) + 36) / Math.max(s.cam.k, 0.08), d = Math.sqrt(d2);
            if (d < min) {
              const push = ((min - d) / d) * 0.2;
              a.vx += dx * push; a.vy += dy * push; b.vx -= dx * push; b.vy -= dy * push;
            }
          }
        }
        for (const p of a.parents ?? []) { // spring to each of its hubs, shared out
          const dx = p.x - a.x, dy = p.y - a.y;
          const d = Math.hypot(dx, dy) || 1, f = ((d - 50) * 0.02) / a.parents.length;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          p.vx -= (dx / d) * f * 0.1; p.vy -= (dy / d) * f * 0.1;
        }
        a.vx -= a.x * 0.002; a.vy -= a.y * 0.002; // gravity to centre
      }
      for (const n of nodes) {
        if (n === s.dragged || n.pinned) { n.vx = n.vy = 0; continue; } // held by the mouse, or dropped there
        n.vx *= 0.8; n.vy *= 0.8;
        n.x += Math.max(-20, Math.min(20, n.vx));
        n.y += Math.max(-20, Math.min(20, n.vy));
      }
    }

    // Until the user zooms or drags, keep easing the camera so every dot is in view.
    function fit() {
      if (s.userCam || !s.nodes.length) return;
      const xs = s.nodes.map((n) => n.x), ys = s.nodes.map((n) => n.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 120 + 2 * tuneRef.current.dot * HUB_DOTS; // header, plus hub circles at the edges
      // fit the graph into the area left of the right-hand panel (detail = half the screen)
      const side = SIDE_W + 48; // the right-hand column of panels
      const k = Math.min(8, Math.max(0.05, Math.min(
        (canvas.clientWidth - side) / (maxX - minX + pad / s.cam.k),
        canvas.clientHeight / (maxY - minY + pad / s.cam.k),
      )));
      const ease = (a, b) => a + (b - a) * 0.15;
      s.cam = { k: ease(s.cam.k, k), x: ease(s.cam.x, (minX + maxX) / 2 + side / 2 / k), y: ease(s.cam.y, (minY + maxY) / 2) };
      if (Math.abs(s.cam.k - s.shownK) > 0.01) { s.shownK = s.cam.k; setZoom(s.cam.k); }
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pos = new Map(s.nodes.map((n) => [n, toScreen(n)]));
      ctx.strokeStyle = color("--edge");
      ctx.lineWidth = 1;
      const edges = (n) => {
        for (const p of n.parents ?? []) {
          const a = pos.get(n), b = pos.get(p);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      };
      for (const n of s.nodes) edges(n);
      ctx.strokeStyle = color("--black"); // white: lines of the hovered and the selected image
      if (s.hover) edges(s.hover);
      const picked = detailRef.current && s.byId.get(detailRef.current.id);
      if (picked && pos.has(picked)) edges(picked);

      // Find the hovered dot, then draw dots with a fisheye bump near the cursor.
      const t = tuneRef.current, k = s.cam.k;
      s.hover = null;
      let best = 20;
      const items = s.nodes.filter((n) => !n.hub);
      const overHub = hubAt(s.mouse);
      for (const n of items) {
        if (!s.mouse || overHub) break;
        const p = pos.get(n), d = Math.hypot(p.x - s.mouse.x, p.y - s.mouse.y);
        if (d < best) { best = d; s.hover = n; }
      }
      const lensOf = (n) => {
        if (!s.mouse) return 0;
        const p = pos.get(n);
        return Math.max(0, 1 - Math.hypot(p.x - s.mouse.x, p.y - s.mouse.y) / t.lens);
      };
      // A dot is the thumbnail: it grows (eased per node) and, once its radius passes
      // showAt, the image fades in inside it. Small it is a circle; as it grows toward
      // hover size the shape relaxes into a rounded square.
      const open = picked && pos.has(picked) ? picked : null; // image shown in the detail panel
      const ordered = [...items.filter((n) => n !== s.hover && n !== open), ...new Set([s.hover, open])].filter(Boolean); // hovered and open on top
      const dotMax = t.dot * k * (1 + t.lensGain);
      for (const n of ordered) {
        const p = pos.get(n);
        let target = t.dot * k * (1 + t.lensGain * lensOf(n));
        if (n === s.hover && n.img) target = Math.max(target, t.hover);
        if (!n.img) target = Math.min(target, dotMax);
        n.r = n.r == null ? target : n.r + (target - n.r) * 0.25;
        const r = n.r;

        // white near the cursor (and when hovered or open); elsewhere the same grey as the lines
        ctx.fillStyle = color(lensOf(n) > 0 || n === s.hover || n === open ? "--black" : "--grey");
        ctx.globalAlpha = n.img ? 1 : 0.25; // no thumbnail yet: faint dot
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        const show = n.img ? Math.min(1, Math.max(0, (r - t.showAt) / 4)) : 0; // 4px fade-in
        const square = show > 0 ? Math.min(1, Math.max(0, (r - t.showAt) / Math.max(1, t.hover - t.showAt))) : 0;
        const corner = r + (Math.min(t.corner, r) - r) * square; // circle → rounded square
        if (show > 0) {
          const iw = n.img.naturalWidth, ih = n.img.naturalHeight, side = Math.min(iw, ih);
          ctx.save();
          ctx.globalAlpha = show;
          ctx.beginPath(); ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, corner); ctx.clip();
          ctx.drawImage(n.img, (iw - side) / 2, (ih - side) / 2, side, side, p.x - r, p.y - r, r * 2, r * 2);
          ctx.restore();
        }
        if (n === open) { // border that follows the thumbnail's shape (circle → rounded square)
          ctx.strokeStyle = color("--black"); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(p.x - r - 1, p.y - r - 1, r * 2 + 2, r * 2 + 2, corner + 1); ctx.stroke();
          ctx.lineWidth = 1;
        }
      }

      ctx.fillStyle = color("--black");
      ctx.font = `500 12px ${color("--font-label")}`;
      ctx.textAlign = "center";
      pickReps();
      const hubs = s.nodes.filter((n) => n.hub);
      for (const n of hubs) {
        const p = pos.get(n), img = hubImg(n), r = hubR(n);
        if (img) {
          const iw = img.naturalWidth, ih = img.naturalHeight, side = Math.min(iw, ih);
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.18)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, p.x - r, p.y - r, r * 2, r * 2);
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Labels last, with a white outline, so no thumbnail or line covers them.
      ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = color("--white");
      for (const n of hubs) {
        const p = pos.get(n), y = p.y - hubR(n) - 8;
        ctx.strokeText(n.id, p.x, y); ctx.fillText(n.id, p.x, y);
      }
      ctx.lineWidth = 1;
      if (s.hover?.entry.title) {
        const p = pos.get(s.hover);
        ctx.fillStyle = color("--black");
        ctx.font = `500 13px ${color("--font")}`;
        ctx.fillText(s.hover.entry.title.slice(0, 60), p.x, p.y + Math.max(t.hover, t.dot * k) + 20);
      }
      if (s.hover?.entry.tags?.length) {
        const p = pos.get(s.hover);
        ctx.font = `400 11px ${color("--font")}`;
        ctx.fillText(s.hover.entry.tags.join(" · "), p.x, p.y + Math.max(t.hover, t.dot * k) + 38);
      }
      canvas.style.cursor = s.dragged ? "grabbing" : s.hover || hubAt(s.mouse) ? "pointer" : "grab";
    }

    const loop = () => { step(); fit(); draw(); raf = requestAnimationFrame(loop); };
    loop();

    // Wheel zooms around the cursor, drag pans, click shows the image in the detail panel.
    let drag = null;
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onWheel = (e) => {
      e.preventDefault();
      s.userCam = true;
      const m = local(e), k = Math.min(8, Math.max(0.05, s.cam.k * Math.exp(-e.deltaY * 0.002)));
      const wx = (m.x - canvas.clientWidth / 2) / s.cam.k + s.cam.x, wy = (m.y - canvas.clientHeight / 2) / s.cam.k + s.cam.y;
      s.cam = { k, x: wx - (m.x - canvas.clientWidth / 2) / k, y: wy - (m.y - canvas.clientHeight / 2) / k };
      setZoom(k);
    };
    // Press on a dot or hub and move: drag it (its links pull neighbours along, like Obsidian);
    // where you drop it, it stays (Reset in the Display panel unpins everything).
    // Press on empty space and move: pan. Press and release without moving on a dot: open it.
    const onDown = (e) => {
      const m = local(e);
      drag = { ...m, cam: { ...s.cam }, moved: false, node: s.hover ?? hubAt(m) };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      s.mouse = local(e);
      if (!drag) return;
      const dx = s.mouse.x - drag.x, dy = s.mouse.y - drag.y;
      if (Math.hypot(dx, dy) > 3) { drag.moved = true; s.userCam = true; } // camera stays put while you work
      if (!drag.moved) return;
      if (drag.node) {
        s.dragged = drag.node;
        drag.node.pinned = true;
        drag.node.x = (s.mouse.x - canvas.clientWidth / 2) / s.cam.k + s.cam.x;
        drag.node.y = (s.mouse.y - canvas.clientHeight / 2) / s.cam.k + s.cam.y;
        s.heat = Math.max(s.heat ?? 0, 0.6); // wake the layout so neighbours follow
      } else {
        s.cam = { ...drag.cam, x: drag.cam.x - dx / s.cam.k, y: drag.cam.y - dy / s.cam.k };
      }
    };
    const onUp = () => {
      if (drag && !drag.moved && drag.node && !drag.node.hub) openDetail(drag.node.entry);
      drag = null;
      s.dragged = null;
    };
    const onLeave = () => { s.mouse = null; drag = null; s.dragged = null; };
    const onKey = (e) => { if (e.key === "Escape") closeDetail(); };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const empty = stats.links === 0;

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="graph" />
      <div className="side">
        <div className="tag-search glass">
          <p className="tag-status">
            {!online ? "AI analyser is off — open axia-prototype/Axia-실행-Mac.command"
              : selected.length ? `${hits} of ${stats.links} references` : `${stats.links} references · ${tags.length} terms`}
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (showSuggest) addTag(suggestions[active]?.[0]); }} role="search">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input value={query} placeholder={selected.length ? "Add another filter" : "Search tags, types, groups, platforms"}
              aria-label="Search tags" role="combobox" aria-autocomplete="list" aria-expanded={showSuggest}
              aria-controls="tag-suggest" aria-activedescendant={showSuggest ? `tag-suggest-${active}` : undefined}
              onChange={(e) => { setQuery(e.target.value); setActive(0); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)} onClick={() => setSuggestOpen(true)}
              onBlur={() => setSuggestOpen(false)} onKeyDown={onSearchKey} />
            {showSuggest && (
              <ul id="tag-suggest" className="suggest" role="listbox" aria-label="Tag suggestions">
                <li className="suggest-head" role="presentation">{q ? "Tags" : selected.length ? "Related tags" : "Popular tags"}</li>
                {suggestions.map(([t, n], i) => {
                  const at = q ? t.toLowerCase().indexOf(q) : -1;
                  return (
                    <li key={t} id={`tag-suggest-${i}`} role="option" aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => { e.preventDefault(); addTag(t); }}>
                      <span>{at < 0 ? t : <>{t.slice(0, at)}<mark>{t.slice(at, at + q.length)}</mark>{t.slice(at + q.length)}</>}</span>
                      <span className="suggest-count">{KIND.get(t) && <em>{KIND.get(t)} · </em>}{n}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </form>
          {selected.length > 0 && (
            <div className="tag-chips">
              {selected.map((t) => (
                <button key={t} type="button" className="chip on" aria-label={`Remove ${t} filter`} title="Remove"
                  onClick={() => setSelected(selected.filter((x) => x !== t))}>{t}<span className="chip-x" aria-hidden="true">×</span></button>
              ))}
              {selected.length > 1 && <button type="button" className="btn" onClick={() => setSelected([])}>Clear all</button>}
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
                <button key={t} type="button" className={selected.includes(t) ? "chip on" : "chip"}
                  title={selected.includes(t) ? "Remove this tag filter" : "Filter the graph by this tag"}
                  onClick={() => (selected.includes(t) ? setSelected(selected.filter((x) => x !== t)) : addTag(t))}>{t}</button>
              ))}
            </div>
            {detail.url && (
              <a href={detail.url} target="_blank" rel="noopener noreferrer" className="btn primary detail-source">
                View source on {hostOf(detail.url)} ↗
              </a>
            )}
          </section>
        )}
        <details className="tuning glass" open={tuningOpen} onToggle={(e) => setTuningOpen(e.currentTarget.open)}>
          <summary>Display <span>· zoom {zoom.toFixed(2)}</span></summary>
          <div className="segmented" role="group" aria-label="Group the graph by">
            {Object.keys(GROUP_BY).map((by) => (
              <button key={by} type="button" aria-pressed={by === groupBy} onClick={() => regroup(by)}>{by}</button>
            ))}
          </div>
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
            <button type="button" className="btn" title="Reset the sliders and unpin dots you moved"
              onClick={() => { setTune(DEFAULTS); try { localStorage.removeItem(STORE); } catch {} unpinAll(); }}>
              Reset
            </button>
          </div>
        </details>
      </div>
      {empty && online && (
        <div className="empty">
          <h1>Nothing here yet</h1>
          <p>Add references (links, files, Instagram JSON) in Reference. They show up here once analysed.</p>
          <Link href="/reference" className="btn primary">Open Reference</Link>
        </div>
      )}
    </div>
  );
}
