// Axia로 보내기 · 백그라운드: 우클릭 메뉴, Axia 앱(내 컴퓨터)으로 전송, 알림
const AXIA = "http://localhost:8770";
const ICON = "icon128.png";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({id: "axia-send", title: "Axia로 보내기", contexts: ["image", "page", "link", "video"]});
    chrome.contextMenus.create({
      id: "axia-board", title: "이 Pinterest 보드 전체를 Axia로 보내기", contexts: ["page"],
      documentUrlPatterns: ["*://*.pinterest.com/*", "*://*.pinterest.co.uk/*", "*://*.pinterest.co.kr/*", "*://*.pinterest.de/*", "*://*.pinterest.fr/*"]
    });
  });
});

function toast(title, message) {
  chrome.notifications.create({type: "basic", iconUrl: ICON, title, message, priority: 1});
}
function badge(text, color) {
  chrome.action.setBadgeText({text});
  if (color) chrome.action.setBadgeBackgroundColor({color});
}
async function post(path, body) {
  try {
    const r = await fetch(AXIA + path, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)});
    return await r.json();
  } catch (e) {
    return {error: "Axia 앱이 꺼져 있어요. 컴퓨터에서 Axia를 먼저 실행해 주세요."};
  }
}

async function sendOne(tab, info) {
  let item = null;
  try { item = await chrome.tabs.sendMessage(tab.id, {type: "AXIA_GET_IMAGE", fallbackSrc: info.srcUrl || null}); } catch (e) { /* 페이지에 content script가 없을 때 */ }
  if (!item && info.srcUrl && !info.srcUrl.startsWith("blob:")) item = {image_url: info.srcUrl, page_url: info.pageUrl, title: tab.title, source: new URL(info.pageUrl).hostname};
  if (!item) return toast("Axia", "이 위치에서 이미지를 못 찾았어요. 이미지 바로 위에서 우클릭해 보세요.");
  badge("…", "#555");
  const r = await post("/api/add", item);
  if (r.error) { badge("!", "#C00000"); return toast("Axia로 못 보냈어요", r.error); }
  badge("✓", "#1a7f37");
  setTimeout(() => badge(""), 2500);
  toast(r.new ? "Axia에 추가했어요" : "이미 Axia에 있는 이미지예요", r.new ? "분석이 끝나면 분야·태그가 붙어요." : "같은 이미지는 한 번만 저장해요.");
}

const boardState = {};
async function startBoard(tabId) {
  const ping = await fetch(AXIA + "/api/ping").then(r => r.json()).catch(() => null);
  if (!ping) return toast("Axia로 못 보냈어요", "Axia 앱이 꺼져 있어요. 컴퓨터에서 Axia를 먼저 실행해 주세요.");
  boardState[tabId] = {added: 0, fresh: 0, failed: 0, found: 0, running: true};
  chrome.storage.session.set({board: boardState[tabId]});
  badge("0", "#2f4bff");
  await chrome.tabs.sendMessage(tabId, {type: "AXIA_COLLECT_BOARD", limit: 500});
  toast("보드 가져오는 중", "탭을 화면에 띄워 두세요. 끝나면 알려 드릴게요.");
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "axia-send") sendOne(tab, info);
  if (info.menuItemId === "axia-board") startBoard(tab.id);
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab && sender.tab.id;
  if (msg.type === "AXIA_PROGRESS" && tabId != null) {
    badge(String(msg.n), "#2f4bff");
  }
  if (msg.type === "AXIA_BATCH" && tabId != null) {
    (async () => {
      const st = boardState[tabId] || (boardState[tabId] = {added: 0, fresh: 0, failed: 0, found: 0, running: true});
      st.found = msg.total;
      if (msg.items.length) {
        const r = await post("/api/add_batch", {items: msg.items});
        if (r.error) { st.failed += msg.items.length; st.error = r.error; }
        else { st.added += r.added; st.fresh += r.new; st.failed += r.failed; }
      }
      if (msg.final) {
        st.running = false;
        badge("✓", "#1a7f37");
        toast("보드 가져오기 완료", st.error ? st.error : `핀 ${st.found}개 → Axia에 ${st.added}장 (새로 ${st.fresh}장${st.failed ? `, 실패 ${st.failed}장` : ""})`);
      }
      chrome.storage.session.set({board: st});
      reply({ok: true});
    })();
    return true;
  }
  if (msg.type === "POPUP_BOARD") { startBoard(msg.tabId); reply({ok: true}); }
  if (msg.type === "POPUP_PAGE") {
    (async () => {
      const r = await post("/api/add", msg.item);
      reply(r);
    })();
    return true;
  }
});
