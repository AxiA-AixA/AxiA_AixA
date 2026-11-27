// Mouse, wheel and touch on the map canvas.
//   Mouse: wheel zooms around the cursor; drag empty space to pan; drag a dot or hub to move it
//          (its links pull neighbours along, and it stays where you drop it); click a dot to open it.
//   Touch: one finger pans, two fingers pinch-zoom, a tap opens a dot (dots are too dense to drag).
// Changes the map state `s` directly and marks it dirty; calls onOpen(entry), onHub(hub), onEmpty() for a click on a
// tag (a hub), and onZoom(k).
import { toScreen, toWorld, zoomedAt } from "./camera";

export function attachInput(canvas, s, { hubAt, onOpen, onHub, onEmpty = () => {}, onZoom }) {
  let drag = null, pinch = null;
  const fingers = new Map();
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const zoomTo = (m, k) => { s.userCam = true; s.cam = zoomedAt(s.cam, canvas, m, k); s.dirty = true; onZoom(s.cam.k); };
  const pan = (dx, dy) => { s.cam = { ...drag.cam, x: drag.cam.x - dx / s.cam.k, y: drag.cam.y - dy / s.cam.k }; s.dirty = true; };
  const dotAt = (m) => { // touch has no hover: find the dot under a tap directly
    let best = 24, hit = null;
    for (const n of s.nodes) {
      if (n.hub) continue;
      const p = toScreen(s.cam, canvas, n), d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < best) { best = d; hit = n; }
    }
    return hit;
  };
  const pinchSpread = () => {
    const [a, b] = [...fingers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onWheel = (e) => { e.preventDefault(); zoomTo(local(e), s.cam.k * Math.exp(-e.deltaY * 0.002)); };
  const onDown = (e) => {
    const m = local(e);
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === "touch") {
      fingers.set(e.pointerId, m);
      if (fingers.size === 2) { pinch = { d: pinchSpread().d, k: s.cam.k }; drag = null; return; }
      drag = { ...m, cam: { ...s.cam }, moved: false };
      return;
    }
    drag = { ...m, cam: { ...s.cam }, moved: false, node: s.hover ?? hubAt(m) };
  };
  const onMove = (e) => {
    const m = local(e);
    if (e.pointerType === "touch") {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, m);
      if (pinch && fingers.size === 2) { const f = pinchSpread(); zoomTo(f.m, (pinch.k * f.d) / pinch.d); return; }
      if (!drag) return;
      if (Math.hypot(m.x - drag.x, m.y - drag.y) > 6) { drag.moved = true; s.userCam = true; } // a little wobble is still a tap
      if (drag.moved) pan(m.x - drag.x, m.y - drag.y);
      return;
    }
    s.mouse = m;
    s.dirty = true;
    if (!drag) return;
    if (Math.hypot(m.x - drag.x, m.y - drag.y) > 3) { drag.moved = true; s.userCam = true; }
    if (!drag.moved) return;
    if (!drag.node) return pan(m.x - drag.x, m.y - drag.y);
    s.dragged = drag.node;
    drag.node.pinned = true;
    Object.assign(drag.node, toWorld(s.cam, canvas, m));
    s.heat = Math.max(s.heat ?? 0, 0.6); // wake the layout so neighbours follow
  };
  const onUp = (e) => {
    if (e.pointerType === "touch") {
      fingers.delete(e.pointerId);
      if (pinch) { if (!fingers.size) pinch = null; drag = null; return; } // lifting after a pinch is not a tap
      if (drag && !drag.moved) { const m = local(e), n = dotAt(m), h = hubAt(m); if (n) onOpen(n.entry); else if (h) onHub(h); else onEmpty(); }
      drag = null;
      return;
    }
    if (drag && !drag.moved && drag.node && !drag.node.hub) onOpen(drag.node.entry);
    else if (drag && !drag.moved && drag.node?.hub) onHub(drag.node);
    else if (drag && !drag.moved) onEmpty();
    drag = null;
    s.dragged = null;
  };
  const onLeave = (e) => { if (e.pointerType === "touch") return; s.mouse = null; s.dirty = true; drag = null; s.dragged = null; };
  const onCancel = (e) => { fingers.delete(e.pointerId); pinch = null; drag = null; s.dragged = null; };

  const listeners = { wheel: onWheel, pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointerleave: onLeave, pointercancel: onCancel };
  for (const [type, fn] of Object.entries(listeners)) canvas.addEventListener(type, fn, type === "wheel" ? { passive: false } : undefined);
  return () => { for (const [type, fn] of Object.entries(listeners)) canvas.removeEventListener(type, fn); };
}
