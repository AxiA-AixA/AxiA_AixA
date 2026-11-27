// Draws the reference map onto a 2D canvas. Reads the map state, writes back only what drawing
// decides: s.hover (dot under the mouse), each node's eased radius n.r, and s.animating (true while
// a dot is still growing or shrinking, so the loop keeps drawing).
import { sizeOf } from "@/lib/graph/thumbs";

// The AxiA symbol (viewBox 1000 × 532.7), drawn at the centre of the map.
const SYMBOL_PATH = "M1000,19.7V5c0-3.6-3.7-6-7-4.6l-484.8,217.3c-5.2,2.3-11.2,2.3-16.4,0L7,.4C3.7-1,0,1.4,0,5v49.6C0,59.7,2,64.7,5.5,68.4l253.1,265.1c4.4,4.6,3.4,12.1-2,15.4L4.7,504.5C1.8,506.3,0,509.6,0,513v14.7c0,3.6,3.7,6,7,4.6l484.8-217.3c5.2-2.3,11.2-2.3,16.4,0l484.8,217.3c3.3,1.5,7-.9,7-4.6v-49.6c0-5.1-2-10.1-5.5-13.8l-253.1-265.1c-4.4-4.6-3.4-12.1,2-15.4L995.3,28.2c2.9-1.8,4.7-5,4.7-8.5Z";
let SYMBOL = null; // Path2D, made on first draw (it only exists in the browser)

// view: { canvas, s, t (display settings), color(cssVar), picked (open node), hubR(hub), hubAt(point), pos(node) }
export function drawMap(ctx, view) {
  const { canvas, s, t, color, picked, hubR, hubAt, pos } = view;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Lines: all in one path, stroked once; the hovered and the open image's lines on top in white.
  const edges = (list) => {
    ctx.beginPath();
    for (const n of list) for (const p of n.parents ?? []) {
      const a = pos(n);
      let b = pos(p);
      if (p.symbol) { // stop short of the symbol so lines don't cross it
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cut = Math.min(d, hubR(p) * 0.62);
        b = { x: b.x + ((a.x - b.x) / d) * cut, y: b.y + ((a.y - b.y) / d) * cut };
      }
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  ctx.strokeStyle = color(s.nodes.length < 60 ? "--line" : "--edge"); // few lines: a little brighter
  edges(s.nodes);
  ctx.strokeStyle = color("--black");
  const items = s.nodes.filter((n) => !n.hub);
  s.hover = findHover(items, s.mouse, hubAt(s.mouse), pos);
  if (s.hover) edges([s.hover]);
  if (picked) edges([picked]);

  drawDots(ctx, items, { ...view, w, h });
  drawHubs(ctx, s.nodes.filter((n) => n.hub), view);
  drawHoverLabel(ctx, view);
  canvas.style.cursor = s.dragged ? "grabbing" : s.hover || hubAt(s.mouse) ? "pointer" : "grab";
}

function findHover(items, mouse, overHub, pos) {
  if (!mouse || overHub) return null;
  let best = 20, hit = null;
  for (const n of items) {
    const p = pos(n), d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (d < best) { best = d; hit = n; }
  }
  return hit;
}

// A dot is its thumbnail: it grows near the cursor (a fisheye lens) and, once its radius passes
// showAt, the image fades in, as a rounded square.
function drawDots(ctx, items, { s, t, color, picked, pos, w, h }) {
  const k = s.cam.k;
  const lensOf = (n) => {
    if (!s.mouse) return 0;
    const p = pos(n);
    return Math.max(0, 1 - Math.hypot(p.x - s.mouse.x, p.y - s.mouse.y) / t.lens);
  };
  const top = new Set([s.hover, picked].filter(Boolean)); // hovered and open drawn last, on top
  const ordered = [...items.filter((n) => !top.has(n)), ...top];
  const dotMax = t.dot * k * (1 + t.lensGain);
  s.animating = false;
  for (const n of ordered) {
    const p = pos(n);
    if (p.x < -dotMax || p.y < -dotMax || p.x > w + dotMax || p.y > h + dotMax) { n.r = null; continue; } // off screen
    const lens = lensOf(n);
    let target = t.dot * k * (1 + t.lensGain * lens);
    if (n === s.hover && n.img) target = Math.max(target, t.hover);
    if (!n.img) target = Math.min(target, dotMax);
    n.r = n.r == null ? target : n.r + (target - n.r) * 0.25;
    if (Math.abs(target - n.r) > 0.2) s.animating = true;
    const r = n.r;

    ctx.fillStyle = color(lens > 0 || n === s.hover || n === picked ? "--black" : "--grey");
    ctx.globalAlpha = n.img ? 1 : 0.25; // no thumbnail yet: faint dot
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const show = n.img ? Math.min(1, Math.max(0, (r - t.showAt) / 4)) : 0; // 4 px fade-in
    const corner = Math.min(t.corner, r * 0.3); // always a rounded square
    if (show > 0) {
      ctx.save();
      ctx.globalAlpha = show;
      ctx.beginPath(); ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, corner); ctx.clip();
      drawCover(ctx, n.img, p.x - r, p.y - r, r * 2);
      ctx.restore();
    }
    if (n === picked) { // border that follows the thumbnail's shape
      ctx.strokeStyle = color("--black"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(p.x - r - 1, p.y - r - 1, r * 2 + 2, r * 2 + 2, corner + 1); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}

// Hubs show a representative thumbnail (one no other hub shows), with their name above.
function drawHubs(ctx, hubs, { color, hubR, pos }) {
  const used = new Set();
  for (const hub of hubs) {
    hub.rep = hub.kids?.find((k) => k.img && !used.has(k)) ?? hub.kids?.find((k) => k.img);
    if (hub.rep) used.add(hub.rep);
  }
  ctx.fillStyle = color("--black");
  for (const n of hubs) {
    const p = pos(n), r = hubR(n), img = n.rep?.img;
    if (n.symbol) { drawSymbol(ctx, p, r, color); continue; }
    if (!img) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.18)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
    drawCover(ctx, img, p.x - r, p.y - r, r * 2);
    ctx.restore();
  }
  // Labels last, with an outline, so no thumbnail or line covers them.
  ctx.font = `500 12px ${color("--font-label")}`;
  ctx.textAlign = "center";
  ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = color("--white");
  for (const n of hubs) {
    if (n.symbol) continue;
    const p = pos(n), y = p.y - hubR(n) - 8;
    ctx.strokeText(n.id, p.x, y); ctx.fillText(n.id, p.x, y);
  }
  ctx.lineWidth = 1;
}

function drawHoverLabel(ctx, { s, t, color, pos }) {
  const n = s.hover;
  if (!n) return;
  const p = pos(n), below = p.y + Math.max(t.hover, t.dot * s.cam.k);
  ctx.fillStyle = color("--black");
  ctx.textAlign = "center";
  if (n.entry.title) {
    ctx.font = `500 13px ${color("--font")}`;
    ctx.fillText(n.entry.title.slice(0, 60), p.x, below + 20);
  }
  if (n.entry.tags?.length) {
    ctx.font = `400 11px ${color("--font")}`;
    ctx.fillText(n.entry.tags.join(" · "), p.x, below + 38);
  }
}

// Draw the centre square of an image into a size×size box.
function drawCover(ctx, img, x, y, size) {
  const { w, h } = sizeOf(img), side = Math.min(w, h);
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, x, y, size, size);
}

// The centre: the AxiA symbol on its own, r = half its width.
function drawSymbol(ctx, p, r, color) {
  const k = (r * 2) / 1000;
  SYMBOL ??= new Path2D(SYMBOL_PATH);
  ctx.save();
  ctx.translate(p.x - 500 * k, p.y - 266.35 * k); ctx.scale(k, k);
  ctx.shadowColor = "rgba(255, 255, 255, 0.18)"; ctx.shadowBlur = 30;
  ctx.fillStyle = color("--black"); ctx.fill(SYMBOL);
  ctx.restore();
}
