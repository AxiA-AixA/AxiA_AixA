const AXIA = "http://localhost:8770";
const $ = s => document.querySelector(s);

(async () => {
  const ping = await fetch(AXIA + "/api/ping").then(r => r.json()).catch(() => null);
  $("#st").className = "st " + (ping ? "ok" : "bad");
  $("#st").textContent = ping ? "Axia 앱과 연결됨" : "Axia 앱이 꺼져 있어요. 컴퓨터에서 Axia를 먼저 실행하세요.";
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  let info = null;
  try { info = await chrome.tabs.sendMessage(tab.id, {type: "AXIA_PAGE_INFO"}); } catch (e) {}
  if (ping && info) {
    $("#board").disabled = !info.isBoard;
    $("#page").disabled = !info.ogImage;
  }
  $("#board").onclick = async () => { await chrome.runtime.sendMessage({type: "POPUP_BOARD", tabId: tab.id}); $("#prog").textContent = "모으는 중… 탭을 화면에 띄워 두세요."; };
  $("#page").onclick = async () => {
    const r = await chrome.runtime.sendMessage({type: "POPUP_PAGE", item: {image_url: info.ogImage, page_url: tab.url, title: info.title, source: new URL(tab.url).hostname.replace("www.", "")}});
    $("#prog").textContent = r.error ? r.error : r.new ? "추가했어요." : "이미 있는 이미지예요.";
  };
  $("#open").onclick = () => chrome.tabs.create({url: AXIA});
  const {board} = await chrome.storage.session.get("board");
  if (board) $("#prog").textContent = board.running ? `보드 모으는 중: 핀 ${board.found}개` : `마지막 보드: ${board.added}장 추가 (새로 ${board.fresh}장)`;
})();
