// The AxiA symbol (white on black), drawn in code so the extension needs no image files.
const AXIA_SYMBOL = "M1000,19.7V5c0-3.6-3.7-6-7-4.6l-484.8,217.3c-5.2,2.3-11.2,2.3-16.4,0L7,.4C3.7-1,0,1.4,0,5v49.6C0,59.7,2,64.7,5.5,68.4l253.1,265.1c4.4,4.6,3.4,12.1-2,15.4L4.7,504.5C1.8,506.3,0,509.6,0,513v14.7c0,3.6,3.7,6,7,4.6l484.8-217.3c5.2-2.3,11.2-2.3,16.4,0l484.8,217.3c3.3,1.5,7-.9,7-4.6v-49.6c0-5.1-2-10.1-5.5-13.8l-253.1-265.1c-4.4-4.6-3.4-12.1,2-15.4L995.3,28.2c2.9-1.8,4.7-5,4.7-8.5Z";

// ImageData of the icon at size×size px (for chrome.action.setIcon).
function iconImage(size) {
  const c = new OffscreenCanvas(size, size), g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, size, size);
  const k = size / 1000;
  g.setTransform(0.7 * k, 0, 0, 0.7 * k, 150 * k, 313.6 * k); // same placement as the site's tab icon
  g.fillStyle = "#fff"; g.fill(new Path2D(AXIA_SYMBOL));
  return g.getImageData(0, 0, size, size);
}

// The icon as a data: URL (for notifications).
async function iconUrl(size = 128) {
  const c = new OffscreenCanvas(size, size);
  c.getContext("2d").putImageData(iconImage(size), 0, 0);
  const bytes = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "data:image/png;base64," + btoa(bin);
}
