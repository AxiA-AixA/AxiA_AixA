// Axia로 보내기 · 페이지 안에서 하는 일
// 1) 우클릭한 위치 아래의 이미지를 찾아요 (인스타처럼 이미지 위에 투명한 막이 덮여 있어도 찾음)
// 2) 핀터레스트 보드를 스크롤하며 핀을 모아요

let lastPoint = null;
document.addEventListener("contextmenu", e => { lastPoint = {x: e.clientX, y: e.clientY}; }, true);

function bestSrc(img) {
  // srcset 중 가장 큰 이미지
  let best = img.currentSrc || img.src, bestW = 0;
  (img.srcset || "").split(",").forEach(part => {
    const [u, w] = part.trim().split(/\s+/);
    const n = parseInt(w) || 0;
    if (u && n > bestW) { best = u; bestW = n; }
  });
  return upgrade(best);
}
function upgrade(u) {
  if (!u) return u;
  if (!/^(data|blob):/.test(u)) { try { u = new URL(u, location.href).href; } catch (e) {} }
  // 핀터레스트 썸네일 → 큰 이미지
  return u.replace(/i\.pinimg\.com\/(\d+x|\d+x\d+)\//, "i.pinimg.com/736x/");
}
function bgImage(el) {
  const m = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
  return m ? m[1] : null;
}
function imageAt(pt) {
  if (!pt) return null;
  for (const el of document.elementsFromPoint(pt.x, pt.y)) {
    if (el.tagName === "IMG" && (el.naturalWidth || el.width) > 40) return {src: bestSrc(el), el};
    if (el.tagName === "VIDEO" && el.poster) return {src: el.poster, el};
    const bg = bgImage(el);
    if (bg && !bg.startsWith("data:image/svg")) return {src: bg, el};
  }
  return null;
}
function pageLinkFor(el) {
  const a = el && el.closest("a[href*='/p/'], a[href*='/reel/'], a[href*='/pin/'], a[href*='/gallery/'], a[href*='/shots/']");
  return a ? a.href : location.href;
}
function og(prop) {
  const m = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
  return m ? m.content : "";
}
async function toDataUrl(src) {
  const blob = await (await fetch(src)).blob();
  return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}

async function getImage(fallbackSrc) {
  const hit = imageAt(lastPoint);
  let src = hit ? hit.src : fallbackSrc;
  let page = hit ? pageLinkFor(hit.el) : location.href;
  if (!src) { src = upgrade(og("og:image")); page = location.href; }
  if (!src) return null;
  if (src.startsWith("blob:")) { try { src = await toDataUrl(src); } catch (e) { return null; } }
  const alt = hit && hit.el.alt ? hit.el.alt : "";
  return {image_url: src, page_url: page, title: (alt || og("og:title") || document.title).slice(0, 200), source: location.hostname.replace("www.", "")};
}

// ---- 핀터레스트 보드 전체 ----
let collecting = false;
function cutoffY() {
  // 보드 끝 아래의 "추천 핀(More ideas)" 영역은 빼요
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
    const all = [...seen.values()];
    const batch = all.slice(sentUpTo);
    if (batch.length && (final || batch.length >= 25)) {
      sentUpTo = all.length;
      await chrome.runtime.sendMessage({type: "AXIA_BATCH", items: batch, total: all.length, final});
    } else if (final) {
      await chrome.runtime.sendMessage({type: "AXIA_BATCH", items: [], total: all.length, final});
    }
  };
  scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 800));
  while (seen.size < limit && idle < 6) {
    const cut = cutoffY();
    const before = seen.size;
    document.querySelectorAll("a[href*='/pin/']").forEach(a => {
      const img = a.querySelector("img[src*='pinimg.com']");
      if (!img) return;
      if (a.getBoundingClientRect().top + scrollY > cut) return;
      const href = a.href.split("?")[0];
      if (!seen.has(href) && seen.size < limit) seen.set(href, {image_url: bestSrc(img), page_url: href, title: (img.alt || "").slice(0, 200), source: "pinterest"});
    });
    idle = seen.size === before ? idle + 1 : 0;
    chrome.runtime.sendMessage({type: "AXIA_PROGRESS", n: seen.size});
    await flush(false);
    if (cut !== Infinity && scrollY + innerHeight > cut) break;
    scrollBy(0, innerHeight * 0.85);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 500));
  }
  await flush(true);
  collecting = false;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "AXIA_GET_IMAGE") { getImage(msg.fallbackSrc).then(reply); return true; }
  if (msg.type === "AXIA_PAGE_INFO") {
    const isBoard = /pinterest\./.test(location.hostname) && !/\/pin\//.test(location.pathname) && location.pathname.split("/").filter(Boolean).length >= 2;
    reply({isBoard, title: document.title, ogImage: upgrade(og("og:image"))});
    return;
  }
  if (msg.type === "AXIA_COLLECT_BOARD") { collectBoard(msg.limit || 500); reply({started: true}); return; }
});
