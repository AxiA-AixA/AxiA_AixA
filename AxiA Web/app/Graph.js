"use client";

import { useEffect, useRef, useState } from "react";
import { extractLinks, hostOf } from "@/lib/links";

// Display values, tunable from the panel under the header. Find good ones, then
// bake them in as the defaults here.
const TUNING = [
  { key: "spread", label: "Spread (dot repulsion)", min: 20, max: 600, step: 10, value: 120 },
  { key: "dot", label: "Dot size", min: 2, max: 12, step: 0.5, value: 5 },
  { key: "showAt", label: "Image shows from radius (px)", min: 3, max: 40, step: 1, value: 7 },
  { key: "lens", label: "Lens reach (px)", min: 40, max: 400, step: 10, value: 150 },
  { key: "lensGain", label: "Lens strength", min: 0, max: 8, step: 0.1, value: 3 },
  { key: "hover", label: "Hover size (px)", min: 20, max: 160, step: 2, value: 60 },
  { key: "corner", label: "Corner radius when large (px)", min: 0, max: 30, step: 1, value: 6 },
];
const DEFAULTS = Object.fromEntries(TUNING.map((t) => [t.key, t.value]));
const STORE = "axia-tuning";

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
  Platform: (e) => [e.url ? hostOf(e.url) : "file"],
};
// Searched tags act as filters: an image shows only if it has every one of them.
const passes = (e, selected) => selected.every((t) => e.tags.includes(t));

export default function Graph() {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const g = useRef({ nodes: [], byId: new Map(), hubs: new Map(), hubCache: new Map(), cam: { x: 0, y: 0, k: 1 }, shownK: 1, mouse: null, hover: null, userCam: false });
  const [text, setText] = useState("");
  const [stats, setStats] = useState({ links: 0, thumbs: 0 });
  const [online, setOnline] = useState(true);
  const [note, setNote] = useState("");
  const [zoom, setZoom] = useState(1);
  const [tune, setTune] = useState(DEFAULTS);
  const [groupBy, setGroupBy] = useState("Type");
  const groupRef = useRef(groupBy);
  const [tags, setTags] = useState([]); // [[tag, count]] among shown images, for suggestions
  const [query, setQuery] = useState("");
  const [selected, setSel] = useState([]);
  const selRef = useRef(selected);
  const [hits, setHits] = useState(0);
  const tuneRef = useRef(tune);
  tuneRef.current = tune;

  // Slider values are remembered per browser so tuning survives a reload.
  useEffect(() => {
    try { setTune({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") }); } catch {}
  }, []);
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

  // New links are saved, then their thumbnails fetched; the server hands each one to the
  // prototype, and it shows up here once it is in the library.
  async function addLinks(raw) {
    const urls = extractLinks(raw);
    if (!urls.length) return;
    const saved = await fetch("/api/imports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    }).then((r) => r.json());
    const todo = saved.filter((e) => !e.fetched).map((e) => e.url);
    setNote(`${urls.length} links added · fetching ${todo.length} thumbnails for analysis`);
    await loadPreviews(todo);
    setNote(`${urls.length} links sent for analysis`);
  }

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
        if (n.entry.tags.join() !== e.tags.join() || keysOf(n.entry).join() !== keysOf(e).join()) changed = true;
        n.entry = e;
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
      if (n.x == null) place(n, n.parents[0]);
    }
    s.userCam = false;
    s.heat = Math.max(s.heat ?? 0, heat); // let the layout move again
    const count = {}; // suggest tags of the shown images, so each pick narrows the result
    for (const n of items) for (const t of n.entry.tags) if (!sel.includes(t)) count[t] = (count[t] ?? 0) + 1;
    setTags(Object.entries(count).sort((a, b) => b[1] - a[1]));
    setHits(items.length);
  }
  function regroup(by) { groupRef.current = by; setGroupBy(by); rebuild(); }
  function setSelected(next) { selRef.current = next; setSel(next); rebuild(); }

  // Exact tag (any case), else the most used tag containing the text ("lit" -> Backlit).
  function addTag(raw) {
    const q = raw.trim().toLowerCase();
    const t = tags.find(([t]) => t.toLowerCase() === q)?.[0] ?? tags.find(([t]) => q && t.toLowerCase().includes(q))?.[0];
    if (!t) return;
    setSelected([...selRef.current, t]);
    setQuery("");
  }

  function loadImage(node, src) {
    const img = new Image();
    img.onload = () => { node.img = img; setStats((v) => ({ ...v, thumbs: v.thumbs + 1 })); };
    img.src = src;
  }

  async function loadPreviews(urls) {
    const queue = [...urls];
    const worker = async () => {
      while (queue.length) await fetch(`/api/preview?url=${encodeURIComponent(queue.shift())}`).catch(() => {});
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  function readFiles(files) {
    for (const f of files) f.text().then(addLinks);
  }

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addLinks(text);
    setText("");
  }

  // Simulation + drawing loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const s = g.current;
    const css = getComputedStyle(document.documentElement);
    const color = (v) => css.getPropertyValue(v).trim();
    let raf;

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
      const pad = 160; // room for the header, tuning panel and composer
      const k = Math.min(8, Math.max(0.05, Math.min(
        canvas.clientWidth / (maxX - minX + pad / s.cam.k),
        canvas.clientHeight / (maxY - minY + pad / s.cam.k),
      )));
      const ease = (a, b) => a + (b - a) * 0.15;
      s.cam = { k: ease(s.cam.k, k), x: ease(s.cam.x, (minX + maxX) / 2), y: ease(s.cam.y, (minY + maxY) / 2) };
      if (Math.abs(s.cam.k - s.shownK) > 0.01) { s.shownK = s.cam.k; setZoom(s.cam.k); }
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pos = new Map(s.nodes.map((n) => [n, toScreen(n)]));
      ctx.strokeStyle = color("--grey");
      ctx.lineWidth = 1;
      const edges = (n) => {
        for (const p of n.parents ?? []) {
          const a = pos.get(n), b = pos.get(p);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      };
      for (const n of s.nodes) edges(n);
      if (s.hover) { ctx.strokeStyle = color("--black"); edges(s.hover); } // which tags the hovered image spans

      // Find the hovered dot, then draw dots with a fisheye bump near the cursor.
      const t = tuneRef.current, k = s.cam.k;
      s.hover = null;
      let best = 20;
      const items = s.nodes.filter((n) => !n.hub);
      for (const n of items) {
        if (!s.mouse) break;
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
      const ordered = s.hover ? [...items.filter((n) => n !== s.hover), s.hover] : items;
      const dotMax = t.dot * k * (1 + t.lensGain);
      for (const n of ordered) {
        const p = pos.get(n);
        let target = t.dot * k * (1 + t.lensGain * lensOf(n));
        if (n === s.hover && n.img) target = Math.max(target, t.hover);
        if (!n.img) target = Math.min(target, dotMax);
        n.r = n.r == null ? target : n.r + (target - n.r) * 0.25;
        const r = n.r;

        ctx.fillStyle = color("--black");
        ctx.globalAlpha = n.img ? 1 : 0.25; // no thumbnail yet: faint dot
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        const show = n.img ? Math.min(1, Math.max(0, (r - t.showAt) / 4)) : 0; // 4px fade-in
        if (show > 0) {
          const square = Math.min(1, Math.max(0, (r - t.showAt) / Math.max(1, t.hover - t.showAt)));
          const corner = r + (Math.min(t.corner, r) - r) * square; // circle → rounded square
          const iw = n.img.naturalWidth, ih = n.img.naturalHeight, side = Math.min(iw, ih);
          ctx.save();
          ctx.globalAlpha = show;
          ctx.beginPath(); ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, corner); ctx.clip();
          ctx.drawImage(n.img, (iw - side) / 2, (ih - side) / 2, side, side, p.x - r, p.y - r, r * 2, r * 2);
          ctx.restore();
        }
      }

      ctx.fillStyle = color("--black");
      ctx.font = `500 14px ${color("--font")}`;
      ctx.textAlign = "center";
      for (const n of s.nodes.filter((n) => n.hub)) {
        const p = pos.get(n);
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(n.id, p.x, p.y - 14);
      }
      if (s.hover?.entry.title) {
        const p = pos.get(s.hover);
        ctx.fillStyle = color("--black");
        ctx.font = `500 14px ${color("--font")}`;
        ctx.fillText(s.hover.entry.title.slice(0, 60), p.x, p.y + Math.max(t.hover, t.dot * k) + 20);
      }
      if (s.hover?.entry.tags?.length) {
        const p = pos.get(s.hover);
        ctx.font = `500 12px ${color("--font")}`;
        ctx.fillText(s.hover.entry.tags.join(" · "), p.x, p.y + Math.max(t.hover, t.dot * k) + 38);
      }
      canvas.style.cursor = s.hover ? "pointer" : "grab";
    }

    const loop = () => { step(); fit(); draw(); raf = requestAnimationFrame(loop); };
    loop();

    // Wheel zooms around the cursor, drag pans, click opens the original post.
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
    const onDown = (e) => { drag = { ...local(e), cam: { ...s.cam }, moved: false }; };
    const onMove = (e) => {
      s.mouse = local(e);
      if (!drag) return;
      const dx = s.mouse.x - drag.x, dy = s.mouse.y - drag.y;
      if (Math.hypot(dx, dy) > 3) { drag.moved = true; s.userCam = true; }
      s.cam = { ...drag.cam, x: drag.cam.x - dx / s.cam.k, y: drag.cam.y - dy / s.cam.k };
    };
    const onUp = () => {
      if (drag && !drag.moved && s.hover?.entry.url) window.open(s.hover.entry.url, "_blank", "noopener");
      drag = null;
    };
    const onLeave = () => { s.mouse = null; drag = null; };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const empty = stats.links === 0;

  return (
    <div
      className="stage"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); readFiles(e.dataTransfer.files); }}
    >
      <canvas ref={canvasRef} className="graph" />
      <div className="tag-search">
        <form onSubmit={(e) => { e.preventDefault(); addTag(query); }}>
          <input list="axia-tags" value={query} placeholder="Search tags (e.g. Chrome, Diffused)" aria-label="Search tags"
            onChange={(e) => (tags.some(([t]) => t === e.target.value) ? addTag(e.target.value) : setQuery(e.target.value))} />
          <datalist id="axia-tags">
            {tags.map(([t, n]) => <option key={t} value={t}>{n}</option>)}
          </datalist>
          {selected.length > 0 && <span>{hits} images</span>}
        </form>
        {selected.length > 0 && (
          <div className="tag-chips">
            {selected.map((t) => (
              <button key={t} type="button" className="btn primary" aria-label={`Remove ${t}`}
                onClick={() => setSelected(selected.filter((x) => x !== t))}>{t} ×</button>
            ))}
            <button type="button" className="btn" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
      </div>
      <details className="tuning" open>
        <summary>Tuning · zoom {zoom.toFixed(2)}</summary>
        <div className="tuning-actions">
          {Object.keys(GROUP_BY).map((by) => (
            <button key={by} type="button" className={by === groupBy ? "btn primary" : "btn"}
              aria-pressed={by === groupBy} onClick={() => regroup(by)}>{by}</button>
          ))}
        </div>
        {TUNING.map((p) => (
          <label key={p.key}>
            <span>{p.label}</span>
            <output>{tune[p.key]}</output>
            <input type="range" min={p.min} max={p.max} step={p.step} value={tune[p.key]}
              onChange={(e) => setParam(p.key, Number(e.target.value))} />
          </label>
        ))}
        <div className="tuning-actions">
          <button type="button" className="btn" onClick={() => { g.current.userCam = false; }}>Fit view</button>
          <button type="button" className="btn" onClick={() => { setTune(DEFAULTS); try { localStorage.removeItem(STORE); } catch {} }}>
            Reset
          </button>
        </div>
      </details>
      <input ref={fileRef} type="file" accept=".json,.txt,.csv,.html" multiple hidden
        onChange={(e) => { readFiles(e.target.files); e.target.value = ""; }} />

      {empty && (
        <button className="add" onClick={() => fileRef.current.click()} aria-label="Import a JSON file">+</button>
      )}

      <div className="dock">
        {empty && <h1>Import Your References</h1>}
        <form className="composer" onSubmit={submit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
            placeholder="Paste JSON or links, or drop a file anywhere"
            rows={1}
          />
          <div className="composer-bar">
            <button type="button" className="btn" onClick={() => fileRef.current.click()} aria-label="Upload a file">+ File</button>
            <span>{!online ? "AI analyser is off: open axia-prototype/Axia-실행-Mac.command" : note || (empty ? "Instagram, Pinterest, Are.na exports work" : `${stats.links} references · ${tags.length} tags`)}</span>
            <button type="submit" className="btn primary">Import ↵</button>
          </div>
        </form>
      </div>
    </div>
  );
}
