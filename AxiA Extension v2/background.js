// AxiA v2 extension · background
// Right-click an image → AxiA로 보내기 → a project (or the library only).
// The image goes to the AxiA v2 site (localhost:3001), which adds it to the project and the library;
// the AI tags it, and a notification shows the tags with a button to open the project's spec sheet.
// If the site is off but the analyser runs, the image still goes to the library.
importScripts("icon.js"); // the AxiA symbol, drawn in code (no image files)
const SITE = "http://localhost:3001";
const AXIA = "http://localhost:8770";
let ICON = null; // data: URL of the icon, made once
const setIcon = () => chrome.action.setIcon({ imageData: { 16: iconImage(16), 32: iconImage(32), 48: iconImage(48) } });
const LIB = "lib"; // target id for "library only"

// ---------- menus: one entry per recent project ----------
async function projects() {
  const list = await fetch(`${SITE}/api/projects`).then((r) => r.json()).catch(() => null);
  if (list) chrome.storage.local.set({ projects: list.slice(0, 20) });
  return list ?? (await chrome.storage.local.get("projects")).projects ?? [];
}

let building = null;
function buildMenus() {
  building ??= (async () => {
    const list = (await projects()).slice(0, 8);
    const { target } = await chrome.storage.local.get("target");
    await chrome.contextMenus.removeAll();
    const ctx = ["image", "link", "video", "page"];
    chrome.contextMenus.create({ id: "axia", title: "AxiA로 보내기", contexts: ctx });
    const first = list.find((p) => p.id === target);
    for (const p of [first, ...list.filter((p) => p !== first)].filter(Boolean)) {
      chrome.contextMenus.create({ id: `p:${p.id}`, parentId: "axia", title: `${p.id === target ? "★ " : ""}${p.name}`, contexts: ctx });
    }
    if (list.length) chrome.contextMenus.create({ id: "sep1", parentId: "axia", type: "separator", contexts: ctx });
    chrome.contextMenus.create({ id: LIB, parentId: "axia", title: "보관함에만 넣기", contexts: ctx });
    chrome.contextMenus.create({ id: "sep2", parentId: "axia", type: "separator", contexts: ctx });
    chrome.contextMenus.create({ id: "pick", parentId: "axia", title: "이 페이지 이미지 여러 장 고르기…", contexts: ["page", "image", "link"] });
    chrome.contextMenus.create({ id: "new", parentId: "axia", title: "새 프로젝트 만들기…", contexts: ctx });
  })().finally(() => { building = null; });
  return building;
}
chrome.runtime.onInstalled.addListener(() => { setIcon(); buildMenus(); chrome.alarms.create("menus", { periodInMinutes: 1 }); });
chrome.runtime.onStartup.addListener(() => { setIcon(); buildMenus(); });
chrome.alarms.onAlarm.addListener((a) => a.name === "menus" && buildMenus());

// ---------- sending ----------
async function toast(id, title, message, buttons) {
  ICON ??= await iconUrl(128);
  chrome.notifications.create(id ?? "", { type: "basic", iconUrl: ICON, title, message, priority: 1, ...(buttons ? { buttons } : {}) });
}
function badge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}
const projectName = async (pid) => ((await chrome.storage.local.get("projects")).projects ?? []).find((p) => p.id === pid)?.name ?? "프로젝트";

// target: a project id or LIB. items: [{ image_url, page_url, title, source }]
async function send(target, items) {
  if (!items.length) return toast(null, "AxiA", "보낼 이미지를 못 찾았어요. 이미지 바로 위에서 우클릭해 보세요.");
  badge("…", "#555");
  const url = target === LIB ? `${SITE}/api/library/add` : `${SITE}/api/projects/${target}/add`;
  let r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) })
    .then((res) => res.json()).catch(() => null);
  let note = "";
  if (!r) { // site off: straight to the analyser's library
    const ids = [];
    for (const it of items) {
      const d = await fetch(`${AXIA}/api/add`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(it) }).then((res) => res.json()).catch(() => null);
      if (d?.id) ids.push(d.id);
    }
    if (!ids.length) { badge("!", "#C00000"); return toast(null, "AxiA로 못 보냈어요", "AxiA가 꺼져 있어요. AxiA_v1.4_open을 실행해 주세요."); }
    r = { added: ids, errors: [] };
    note = "AxiA 사이트가 꺼져 있어서 보관함에만 넣었어요. ";
    target = LIB;
  }
  if (r.error || !r.added?.length) {
    badge("!", "#C00000");
    return toast(null, "AxiA로 못 보냈어요", r.error ?? r.errors?.[0]?.error ?? "이미지를 못 가져왔어요.");
  }
  badge("✓", "#1a7f37");
  setTimeout(() => badge(""), 2500);
  const name = target === LIB ? "보관함" : await projectName(target);
  const { recent = [] } = await chrome.storage.local.get("recent");
  const fresh = r.added.map((id, i) => ({ id, target, name, at: Date.now(), page_url: items[i]?.page_url ?? items[0].page_url }));
  chrome.storage.local.set({ recent: [...fresh, ...recent.filter((x) => !r.added.includes(x.id))].slice(0, 12) });
  toast(null, `${name}에 ${r.added.length}장 보냈어요`, `${note}AI가 태그를 붙이면 알려 드릴게요.${r.errors?.length ? ` (${r.errors.length}장 실패)` : ""}`);
  watch(r.added, target);
}

// Wait for the AI tags, then show them with a button to the project's spec sheet.
async function watch(ids, target) {
  const left = new Set(ids);
  for (let i = 0; i < 40 && left.size; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const lib = await fetch(`${SITE}/api/library`).then((r) => r.json()).catch(() => null)
      ?? await fetch(`${AXIA}/api/library`).then((r) => r.json()).then((d) => ({ items: d.items.map((x) => ({ ...x, tags: [...(x.user_tags ?? []), ...(x.tags ?? [])] })) })).catch(() => null);
    if (!lib) continue;
    const done = lib.items.filter((e) => left.has(e.id) && (e.status === "tagged" || e.status === "failed"));
    if (!done.length) continue;
    done.forEach((e) => left.delete(e.id));
    const tags = [...new Set(done.flatMap((e) => e.tags))].slice(0, 8);
    const failed = done.filter((e) => e.status === "failed").length;
    const nid = `tags:${target}:${Date.now()}`;
    const title = failed === done.length ? "분석하지 못했어요" : `태그: ${tags.slice(0, 4).join(" · ")}`;
    toast(nid, title, failed === done.length ? "AxiA 보관함에서 다시 시도할 수 있어요." : tags.join(" · "),
      target === LIB ? [{ title: "보관함 열기" }] : [{ title: "스펙 시트 열기" }]);
    chrome.storage.local.set({ lastTags: { ids: done.map((e) => e.id), tags, at: Date.now() } });
  }
}
chrome.notifications.onButtonClicked.addListener((nid) => {
  const [, target] = nid.split(":");
  if (!target) return;
  chrome.tabs.create({ url: target === LIB ? `${SITE}/library` : `${SITE}/project/${target}#step-spec` });
});

// The image under the right-click (the page knows best: Instagram covers images with a layer).
async function imageFrom(tab, info) {
  let item = null;
  try { item = await chrome.tabs.sendMessage(tab.id, { type: "AXIA_GET_IMAGE", fallbackSrc: info.srcUrl || null }); } catch (e) { /* no content script on this page */ }
  if (!item && info.srcUrl && !info.srcUrl.startsWith("blob:")) item = { image_url: info.srcUrl, page_url: info.pageUrl, title: tab.title, source: new URL(info.pageUrl).hostname };
  return item;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId);
  if (id === "new") return chrome.tabs.create({ url: `${SITE}/` });
  if (id === "pick") return openPicker(tab.id);
  const target = id === LIB ? LIB : id.startsWith("p:") ? id.slice(2) : null;
  if (!target) return;
  chrome.storage.local.set({ target });
  const item = await imageFrom(tab, info);
  send(target, item ? [item] : []);
  buildMenus(); // ★ follows the last used project
});

async function openPicker(tabId) {
  const list = await projects();
  const { target } = await chrome.storage.local.get("target");
  chrome.tabs.sendMessage(tabId, { type: "AXIA_PICK", projects: list.map((p) => ({ id: p.id, name: p.name })), target: target ?? LIB }).catch(() =>
    toast(null, "AxiA", "이 페이지에서는 고를 수 없어요. 페이지를 새로고침한 뒤 다시 해 보세요."));
}

// ---------- Pinterest board → a project ----------
const boards = {};
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab?.id;
  if (msg.type === "AXIA_SEND") { send(msg.target, msg.items); chrome.storage.local.set({ target: msg.target }); reply({ ok: true }); return; }
  if (msg.type === "POPUP_PICK") { openPicker(msg.tabId); reply({ ok: true }); return; }
  if (msg.type === "POPUP_MENUS") { buildMenus().then(() => reply({ ok: true })); return true; }
  if (msg.type === "POPUP_BOARD") {
    boards[msg.tabId] = { target: msg.target, added: 0, found: 0, running: true };
    chrome.storage.session.set({ board: boards[msg.tabId] });
    chrome.tabs.sendMessage(msg.tabId, { type: "AXIA_COLLECT_BOARD", limit: 300 });
    toast(null, "보드 가져오는 중", "탭을 화면에 띄워 두세요. 끝나면 알려 드릴게요.");
    reply({ ok: true });
    return;
  }
  if (msg.type === "AXIA_PROGRESS" && tabId != null) badge(String(msg.n), "#2f4bff");
  if (msg.type === "AXIA_BATCH" && tabId != null) {
    (async () => {
      const st = boards[tabId] ?? (boards[tabId] = { target: LIB, added: 0, found: 0, running: true });
      st.found = msg.total;
      if (msg.items.length) {
        const url = st.target === LIB ? `${SITE}/api/library/add` : `${SITE}/api/projects/${st.target}/add`;
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: msg.items }) }).then((res) => res.json()).catch(() => null);
        st.added += r?.added?.length ?? 0;
      }
      if (msg.final) {
        st.running = false;
        badge("✓", "#1a7f37");
        toast(`tags:${st.target}:${Date.now()}`, "보드 가져오기 완료", `핀 ${st.found}개 → ${st.added}장 보냈어요. 태그는 차례로 붙어요.`, [{ title: st.target === LIB ? "보관함 열기" : "스펙 시트 열기" }]);
      }
      chrome.storage.session.set({ board: st });
      reply({ ok: true });
    })();
    return true;
  }
});
