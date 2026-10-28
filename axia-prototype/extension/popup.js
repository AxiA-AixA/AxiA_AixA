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

  // 잘린 인스타 이미지 → 원본 (로그인된 이 브라우저에서 게시물을 하나씩 열어요)
  const showFix = (f) => {
    if (!f) return;
    $("#fixstop").hidden = !f.running;
    $("#fix").disabled = f.running;
    $("#prog").textContent = f.running ? `원본으로 바꾸는 중: ${f.done}/${f.total} (교체 ${f.fixed}, 실패 ${f.failed}) — 백그라운드 탭을 닫지 마세요.`
      : `마지막 교체: ${f.fixed}장${f.failed ? `, 실패 ${f.failed}장` : ""}. ${f.note || ""}`;
  };
  if (ping) {
    const c = await fetch(AXIA + "/api/cropped").then(r => r.json()).catch(() => ({items: []}));
    $("#fix").disabled = !c.items.length;
    $("#fix").textContent = `잘린 인스타 이미지 원본으로 바꾸기 (${c.items.length}장)`;
  }
  $("#fix").onclick = async () => {
    if (!confirm("인스타그램 게시물을 백그라운드 탭에서 하나씩 열어 원본 이미지를 가져와요. 게시물 사이 몇 초씩 쉬어서 오래 걸려요. 인스타그램에 로그인된 상태여야 해요. 시작할까요?")) return;
    await chrome.runtime.sendMessage({type: "POPUP_FIX"});
    $("#prog").textContent = "시작했어요…";
  };
  $("#fixstop").onclick = () => chrome.runtime.sendMessage({type: "POPUP_FIX_STOP"});
  chrome.storage.session.onChanged.addListener((c) => { if (c.fix) showFix(c.fix.newValue); });
  showFix((await chrome.storage.session.get("fix")).fix);
  const {board} = await chrome.storage.session.get("board");
  if (board) $("#prog").textContent = board.running ? `보드 모으는 중: 핀 ${board.found}개` : `마지막 보드: ${board.added}장 추가 (새로 ${board.fresh}장)`;
})();
