// AxiA v2 extension · in the page
// 1) The image under a right-click (also when a transparent layer covers it, as on Instagram).
// 2) "Pick images on this page": every sizeable image on the page in a panel to choose from —
//    for Are.na, Cosmos, Behance, Dribbble, portfolio sites, anything.
// 3) A whole Pinterest board, by scrolling it.

let lastPoint = null;
document.addEventListener("contextmenu", (e) => { lastPoint = { x: e.clientX, y: e.clientY }; }, true);

const host = location.hostname.replace(/^www\./, "");
const SOURCE = /cosmos\.so$/.test(host) ? "cosmos" : /are\.na$/.test(host) ? "arena" : host;

function bestSrc(img) { // the largest image in srcset
  let best = img.currentSrc || img.src, bestW = 0;
  (img.srcset || "").split(",").forEach((part) => {
    const [u, w] = part.trim().split(/\s+/);
    const n = parseInt(w) || 0;
    if (u && n > bestW) { best = u; bestW = n; }
  });
  return upgrade(best);
}
// Sites that serve small copies by address: ask for a large one.
function upgrade(u) {
  if (!u) return u;
  if (!/^(data|blob):/.test(u)) { try { u = new URL(u, location.href).href; } catch (e) {} }
  return u
    .replace(/i\.pinimg\.com\/(\d+x|\d+x\d+)\//, "i.pinimg.com/736x/")                          // Pinterest
    .replace(/(mir-s3-cdn-cf\.behance\.net\/project_modules\/)[a-z_0-9]+\//, "$1max_1200/")       // Behance
    .replace(/(cdn\.dribbble\.com\/userupload\/[^?]+)\?.*$/, "$1?resize=1600x0");                 // Dribbble
}
function bgImage(el) {
  const m = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
  return m ? m[1] : null;
}
function imageAt(pt) {
  if (!pt) return null;
  for (const el of document.elementsFromPoint(pt.x, pt.y)) {
    if (el.tagName === "IMG" && (el.naturalWidth || el.width) > 40) return { src: bestSrc(el), el };
    if (el.tagName === "VIDEO" && el.poster) return { src: el.poster, el };
    const bg = bgImage(el);
    if (bg && !bg.startsWith("data:image/svg")) return { src: upgrade(bg), el };
  }
  return null;
}
// The page an image belongs to (a pin, a post, a block, a project), else this page.
function pageLinkFor(el) {
  const a = el && el.closest("a[href*='/p/'], a[href*='/reel/'], a[href*='/pin/'], a[href*='/gallery/'], a[href*='/shots/'], a[href*='/block/'], a[href*='/e/']");
  return a ? a.href : location.href;
}
function og(prop) {
  const m = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
  return m ? m.content : "";
}
async function toDataUrl(src) {
  const blob = await (await fetch(src)).blob();
  return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}
async function itemFor(src, el) {
  if (src.startsWith("blob:")) { try { src = await toDataUrl(src); } catch (e) { return null; } }
  const alt = el?.alt || "";
  return { image_url: src, page_url: pageLinkFor(el), title: (alt || og("og:title") || document.title).slice(0, 200), source: SOURCE };
}

async function getImage(fallbackSrc) {
  const hit = imageAt(lastPoint);
  if (hit) return itemFor(hit.src, hit.el);
  const src = fallbackSrc || upgrade(og("og:image"));
  return src ? itemFor(src, null) : null;
}

// ---------- every sizeable image on the page ----------
function pageImages() {
  const out = new Map();
  const add = (src, el) => {
    if (!src || src.startsWith("data:image/svg") || /\.svg(\?|$)/i.test(src)) return;
    const key = src.replace(/\?.*$/, "");
    if (!out.has(key)) out.set(key, { src, el });
  };
  for (const img of document.images) {
    const r = img.getBoundingClientRect();
    if ((img.naturalWidth || 0) >= 200 && (img.naturalHeight || 0) >= 150 && r.width >= 80) add(bestSrc(img), img);
  }
  for (const el of document.querySelectorAll("[style*='background']")) {
    const r = el.getBoundingClientRect();
    if (r.width >= 150 && r.height >= 120) add(upgrade(bgImage(el)), el);
  }
  for (const v of document.querySelectorAll("video[poster]")) add(upgrade(v.poster), v);
  if (!out.size && og("og:image")) add(upgrade(og("og:image")), null);
  return [...out.values()].slice(0, 200);
}

// The picker panel, in a shadow root so the page's styles can't reach it.
function openPicker(projects, target) {
  document.getElementById("axia-picker")?.remove();
  const found = pageImages();
  const hostEl = Object.assign(document.createElement("div"), { id: "axia-picker" });
  const root = hostEl.attachShadow({ mode: "open" });
  const picked = new Set();
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; font: 13px/1.4 -apple-system, "Pretendard", "Malgun Gothic", sans-serif; }
      .panel { width: min(960px, calc(100vw - 40px)); max-height: calc(100vh - 40px); display: flex; flex-direction: column; background: #111; color: #f4f4f4; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
      header, footer { display: flex; align-items: center; gap: 10px; padding: 14px 16px; }
      header b { font-size: 15px; } .grow { flex: 1; } .muted { color: #999; }
      .grid { overflow: auto; padding: 0 16px 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); grid-auto-rows: 150px; gap: 10px; }
      .grid button { position: relative; height: 100%; padding: 0; border: 2px solid transparent; border-radius: 10px; overflow: hidden; background: #222; cursor: pointer; }
      .grid button.on { border-color: #fff; }
      .grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .grid button.on::after { content: "✓"; position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: #fff; color: #000; font-weight: 700; display: grid; place-items: center; }
      select, .btn { font: inherit; color: inherit; background: #222; border: 1px solid #444; border-radius: 8px; padding: 7px 10px; }
      .btn { cursor: pointer; } .btn.primary { background: #fff; color: #000; border-color: #fff; } .btn:disabled { opacity: .4; cursor: default; }
      .empty { padding: 40px 16px; text-align: center; color: #999; }
    </style>
    <div class="wrap">
      <div class="panel" role="dialog" aria-label="AxiA로 보낼 이미지 고르기">
        <header><b>AxiA로 보낼 이미지 고르기</b><span class="muted">${found.length}장 찾음</span><span class="grow"></span>
          <button class="btn" id="all">모두 선택</button><button class="btn" id="close" aria-label="닫기">✕</button></header>
        <div class="grid">${found.length ? "" : `<p class="empty">이 페이지에서 큰 이미지를 못 찾았어요. 스크롤해서 이미지를 불러온 뒤 다시 해 보세요.</p>`}</div>
        <footer><span>보낼 곳</span><select id="target"></select><span class="grow"></span>
          <span class="muted" id="count">0장 선택</span><button class="btn primary" id="send" disabled>보내기</button></footer>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const grid = $(".grid");
  found.forEach((f, i) => {
    const b = document.createElement("button");
    b.innerHTML = `<img src="${f.src.replace(/"/g, "&quot;")}" alt="" loading="lazy">`;
    b.onclick = () => { picked.has(i) ? picked.delete(i) : picked.add(i); b.classList.toggle("on", picked.has(i)); update(); };
    grid.appendChild(b);
  });
  const sel = $("#target");
  for (const p of projects) sel.add(new Option(`프로젝트: ${p.name}`, p.id, false, p.id === target));
  sel.add(new Option("보관함에만", "lib", false, target === "lib"));
  const update = () => { $("#count").textContent = `${picked.size}장 선택`; $("#send").disabled = !picked.size; };
  $("#all").onclick = () => { const on = picked.size < found.length; grid.querySelectorAll("button").forEach((b, i) => { on ? picked.add(i) : picked.delete(i); b.classList.toggle("on", on); }); update(); };
  const close = () => hostEl.remove();
  $("#close").onclick = close;
  $(".wrap").onclick = (e) => { if (e.target === $(".wrap")) close(); };
  root.addEventListener("keydown", (e) => e.key === "Escape" && close());
  $("#send").onclick = async () => {
    $("#send").disabled = true; $("#send").textContent = "보내는 중…";
    const items = (await Promise.all([...picked].map((i) => itemFor(found[i].src, found[i].el)))).filter(Boolean);
    chrome.runtime.sendMessage({ type: "AXIA_SEND", target: sel.value, items });
    close();
  };
  document.documentElement.appendChild(hostEl);
}

// ---------- a whole Pinterest board ----------
let collecting = false;
function cutoffY() { // leave out "More ideas" under the board
  for (const h of document.querySelectorAll("h2, h3, [role='heading']")) {
    if (/more ideas|find more|more like this|아이디어 더|더 많은 아이디어|비슷한/i.test(h.textContent || "")) return h.getBoundingClientRect().top + scrollY;
  }
  return Infinity;
}
async function collectBoard(limit) {
  if (collecting) return;
  collecting = true;
  const seen = new Map();
  let idle = 0, sentUpTo = 0;
  const flush = async (final) => {
    const all = [...seen.values()], batch = all.slice(sentUpTo);
    if (batch.length && (final || batch.length >= 25)) { sentUpTo = all.length; await chrome.runtime.sendMessage({ type: "AXIA_BATCH", items: batch, total: all.length, final }); }
    else if (final) await chrome.runtime.sendMessage({ type: "AXIA_BATCH", items: [], total: all.length, final });
  };
  scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 800));
  while (seen.size < limit && idle < 6) {
    const cut = cutoffY(), before = seen.size;
    document.querySelectorAll("a[href*='/pin/']").forEach((a) => {
      const img = a.querySelector("img[src*='pinimg.com']");
      if (!img || a.getBoundingClientRect().top + scrollY > cut) return;
      const href = a.href.split("?")[0];
      if (!seen.has(href) && seen.size < limit) seen.set(href, { image_url: bestSrc(img), page_url: href, title: (img.alt || "").slice(0, 200), source: "pinterest" });
    });
    idle = seen.size === before ? idle + 1 : 0;
    chrome.runtime.sendMessage({ type: "AXIA_PROGRESS", n: seen.size });
    await flush(false);
    if (cut !== Infinity && scrollY + innerHeight > cut) break;
    scrollBy(0, innerHeight * 0.85);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 500));
  }
  await flush(true);
  collecting = false;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "AXIA_GET_IMAGE") { getImage(msg.fallbackSrc).then(reply); return true; }
  if (msg.type === "AXIA_PICK") { openPicker(msg.projects, msg.target); reply({ ok: true }); return; }
  if (msg.type === "AXIA_PAGE_INFO") {
    const isBoard = /pinterest\./.test(location.hostname) && !/\/pin\//.test(location.pathname) && location.pathname.split("/").filter(Boolean).length >= 2;
    reply({ isBoard, images: pageImages().length });
    return;
  }
  if (msg.type === "AXIA_COLLECT_BOARD") { collectBoard(msg.limit || 300); reply({ started: true }); return; }
});
