// Loads images for the map a few at a time and keeps only a small, decoded, square copy of each
// (drawing hundreds of full-size images every frame is what made the map heavy).

const SIZE = 256;     // px, square: enough for the hover size on a retina screen
const AT_ONCE = 6;    // images fetched at the same time
const queue = [];
let loading = 0;

// Load the first of `srcs` that works into node.img, then call done(node).
export function loadThumb(node, srcs, done) {
  queue.push({ node, srcs: srcs.filter(Boolean), done });
  pump();
}

function pump() {
  while (loading < AT_ONCE && queue.length) {
    const job = queue.shift();
    loading++;
    tryNext(job, 0);
  }
}

function tryNext(job, i) {
  const finish = (img) => {
    loading--;
    if (img) { job.node.img = img; job.done(job.node); }
    pump();
  };
  if (i >= job.srcs.length) return finish(null);
  const img = new Image();
  img.decoding = "async";
  img.onerror = () => tryNext(job, i + 1); // e.g. an older analyser without /thumb: use the original
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h), size = Math.min(SIZE, side);
    createImageBitmap(img, (w - side) / 2, (h - side) / 2, side, side, { resizeWidth: size, resizeHeight: size, resizeQuality: "medium" })
      .then(finish, () => finish(img)); // no resize support: keep the image itself
  };
  img.src = job.srcs[i];
}

// Width and height of an <img> or an ImageBitmap.
export const sizeOf = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
