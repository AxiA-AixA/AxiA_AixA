// Force layout for the reference map. Pure: works on plain node objects
// { x, y, vx, vy, hub, parents: [hub], pinned }, no canvas or React.
//
// Forces: every node pushes every other (through a quadtree, so 1,000+ nodes stay cheap), each
// image is pulled to its hubs, hubs push each other harder and keep a gap, everything is pulled
// to the centre. step() returns false once the layout has cooled down.

export const HUB_PUSH = 6000; // hub–hub repulsion (images use the `spread` setting)
const THETA = 0.8;            // quadtree accuracy: larger = faster and rougher
const MAX_MOVE = 20;          // per step, in world units
const COOL = 0.985;           // heat kept per step
export const SETTLED = 0.02;  // heat below which the layout stops

// Put a node near another (or near the centre), with a little jitter so nodes don't stack.
export function place(n, near) {
  const p = near ?? { x: 0, y: 0 };
  return Object.assign(n, { x: p.x + (Math.random() - 0.5) * 80, y: p.y + (Math.random() - 0.5) * 80, vx: 0, vy: 0 });
}

// One step. state: { nodes, heat, dragged }. hubGap(a, b): the closest two hubs may be (world units).
export function step(state, { spread, hubGap }) {
  if (!(state.heat > SETTLED)) return false;
  state.heat *= COOL;
  const { nodes } = state;
  // Every node pushes every other, so the cloud grows with the library; the pull to the centre grows
  // with it (a fixed pull let 1,000 references fly outwards and freeze as a square).
  const gravity = 0.002 * Math.max(1, nodes.length / 150);
  const tree = buildTree(nodes);

  const hubs = nodes.filter((n) => n.hub);
  for (let i = 0; i < hubs.length; i++) {
    for (let j = i + 1; j < hubs.length; j++) {
      const a = hubs[i], b = hubs[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy || 0.01;
      const f = (HUB_PUSH - spread) / d2; // the tree already gave this pair `spread`
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      const min = hubGap(a, b), d = Math.sqrt(d2);
      if (d < min) {
        const push = ((min - d) / d) * 0.2;
        a.vx += dx * push; a.vy += dy * push; b.vx -= dx * push; b.vy -= dy * push;
      }
    }
  }
  for (const a of nodes) {
    repel(tree, a, spread);
    for (const p of a.parents ?? []) { // spring to each of its hubs, shared out
      const dx = p.x - a.x, dy = p.y - a.y;
      const d = Math.hypot(dx, dy) || 1, f = ((d - 50) * 0.02) / a.parents.length;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      p.vx -= (dx / d) * f * 0.1; p.vy -= (dy / d) * f * 0.1;
    }
    a.vx -= a.x * gravity; a.vy -= a.y * gravity;
  }
  for (const n of nodes) {
    if (n === state.dragged || n.pinned) { n.vx = n.vy = 0; continue; } // held by the mouse, or dropped there
    n.vx *= 0.8; n.vy *= 0.8;
    n.x += Math.max(-MAX_MOVE, Math.min(MAX_MOVE, n.vx));
    n.y += Math.max(-MAX_MOVE, Math.min(MAX_MOVE, n.vy));
  }
  return true;
}

// Bounding box of the nodes: { minX, maxX, minY, maxY }.
export function bounds(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  }
  return { minX, maxX, minY, maxY };
}

// ---------- Barnes–Hut quadtree: far-away groups push as one ----------
export function buildTree(nodes) {
  const { minX, maxX, minY, maxY } = bounds(nodes);
  const root = cell((minX + maxX) / 2, (minY + maxY) / 2, Math.max(maxX - minX, maxY - minY) / 2 + 1);
  for (const n of nodes) insert(root, n, 0);
  return root;
}
const cell = (x, y, half) => ({ x, y, half, m: 0, cx: 0, cy: 0, node: null, kids: null });
const quadrant = (t, n) => (n.x > t.x) | ((n.y > t.y) << 1);

function insert(t, n, depth) {
  t.cx = (t.cx * t.m + n.x) / (t.m + 1); t.cy = (t.cy * t.m + n.y) / (t.m + 1); t.m++;
  if (t.m === 1) { t.node = n; return; }
  if (depth > 24) return; // nodes on the same spot: count them, don't split forever
  if (!t.kids) {
    const h = t.half / 2;
    t.kids = [0, 1, 2, 3].map((q) => cell(t.x + (q & 1 ? h : -h), t.y + (q & 2 ? h : -h), h));
    if (t.node) { const o = t.node; t.node = null; insert(t.kids[quadrant(t, o)], o, depth + 1); }
  }
  insert(t.kids[quadrant(t, n)], n, depth + 1);
}

export function repel(t, a, spread) {
  if (!t.m || t.node === a) return;
  const dx = a.x - t.cx, dy = a.y - t.cy;
  const d2 = dx * dx + dy * dy || 0.01;
  const size = 2 * t.half;
  if (t.kids && size * size > THETA * THETA * d2) { for (const k of t.kids) repel(k, a, spread); return; }
  const f = (spread * t.m) / d2;
  a.vx += dx * f; a.vy += dy * f;
}
