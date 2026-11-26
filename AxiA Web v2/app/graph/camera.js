// Camera for the map: world <-> screen, zoom around a point, and fitting every node in view.
import { bounds } from "@/lib/graph/layout";

export const ZOOM_MIN = 0.02, ZOOM_MAX = 8;
const clampZoom = (k) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));

export const toScreen = (cam, canvas, n) => ({
  x: (n.x - cam.x) * cam.k + canvas.clientWidth / 2,
  y: (n.y - cam.y) * cam.k + canvas.clientHeight / 2,
});
export const toWorld = (cam, canvas, m) => ({
  x: (m.x - canvas.clientWidth / 2) / cam.k + cam.x,
  y: (m.y - canvas.clientHeight / 2) / cam.k + cam.y,
});

// Camera at zoom k with the world point under screen point m kept where it is.
export function zoomedAt(cam, canvas, m, k) {
  k = clampZoom(k);
  const w = toWorld(cam, canvas, m);
  return { k, x: w.x - (m.x - canvas.clientWidth / 2) / k, y: w.y - (m.y - canvas.clientHeight / 2) / k };
}

// One easing step toward the camera that shows every node in the free area of the canvas
// (`side` px are covered by panels on the right, `top` px on top). Returns the new camera.
export function fitStep(cam, canvas, nodes, { pad, side, top }) {
  const { minX, maxX, minY, maxY } = bounds(nodes);
  const k = clampZoom(Math.min(
    (canvas.clientWidth - side) / (maxX - minX + pad / cam.k),
    (canvas.clientHeight - top) / (maxY - minY + pad / cam.k),
  ));
  const ease = (a, b) => a + (b - a) * 0.15;
  return { k: ease(cam.k, k), x: ease(cam.x, (minX + maxX) / 2 + side / 2 / k), y: ease(cam.y, (minY + maxY) / 2 - top / 2 / k) };
}

// Did the camera move enough to be worth a redraw?
export const camMoved = (a, b) => Math.abs(a.k - b.k) / b.k > 0.001 || Math.hypot(a.x - b.x, a.y - b.y) * b.k > 0.3;
