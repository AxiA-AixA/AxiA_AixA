import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, repel, step, place, bounds } from "../lib/graph/layout.js";
import { countTerms, passes, suggest, termsOf } from "../lib/graph/terms.js";

const dot = (x, y) => ({ x, y, vx: 0, vy: 0 });

test("quadtree repulsion matches the exact sum closely", () => {
  const nodes = Array.from({ length: 300 }, (_, i) => dot(Math.cos(i) * (i + 10) * 3, Math.sin(i * 1.7) * (i + 10) * 3));
  const tree = buildTree(nodes);
  const errors = nodes.map((a) => {
    const exact = { vx: 0, vy: 0 };
    let total = 0; // sum of every single push, so dots where the pushes cancel out don't blow up the ratio
    for (const b of nodes) {
      if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y, f = 400 / (dx * dx + dy * dy);
      exact.vx += dx * f; exact.vy += dy * f; total += Math.hypot(dx * f, dy * f);
    }
    const approx = { ...a, vx: 0, vy: 0 };
    repel(tree, approx, 400);
    return Math.hypot(approx.vx - exact.vx, approx.vy - exact.vy) / total;
  });
  assert.ok(Math.max(...errors) < 0.03, `worst error ${Math.max(...errors).toFixed(4)} of the total push`);
});

test("a large library settles round, not as a square", () => {
  const hubs = ["Red", "Blue", "Green"].map((id) => place({ id, hub: true }));
  const items = Array.from({ length: 800 }, (_, i) => { const n = place({ id: i }, hubs[i % 3]); n.parents = [hubs[i % 3]]; return n; });
  const state = { nodes: [...items, ...hubs], heat: 1 };
  let steps = 0;
  while (step(state, { spread: 400, hubGap: () => 100 }) && steps < 2000) steps++;
  assert.ok(steps < 2000, "cools down");
  // A square jam fills the corners of its bounding box; a round cloud leaves them empty.
  const { minX, maxX, minY, maxY } = bounds(items);
  const cornerX = (maxX - minX) * 0.1, cornerY = (maxY - minY) * 0.1;
  const inCorners = items.filter((n) => (n.x < minX + cornerX || n.x > maxX - cornerX) && (n.y < minY + cornerY || n.y > maxY - cornerY)).length;
  assert.ok(inCorners / items.length < 0.03, `${inCorners} dots in the corners`);
});

const entry = (tags, extra = {}) => ({ tags, fields: [], colors: [], status: "tagged", ...extra });

test("search terms include types, groups and platforms", () => {
  const e = entry(["Minimal"], { fields: ["3d"], group_name: "posters", url: "https://kr.pinterest.com/pin/1" });
  assert.deepEqual(termsOf(e), ["Minimal", "3D", "Posters", "pinterest.com"]);
  assert.equal(passes(e, ["Minimal", "3D"]), true);
  assert.equal(passes(e, ["Glossy"]), false);
});

test("suggestions: prefix matches first, then by count", () => {
  const terms = countTerms([entry(["Matte", "Minimal"]), entry(["Minimal"]), entry(["Chrome"])]);
  assert.deepEqual(terms[0], ["Minimal", 2]);
  assert.deepEqual(suggest(terms, "m").map(([t]) => t), ["Minimal", "Matte", "Chrome"]);
});
