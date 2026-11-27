const SITE = "http://localhost:3001";
const AXIA = "http://localhost:8770";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

(async () => {
  const [site, analyser] = await Promise.all([
    fetch(`${SITE}/api/projects`).then((r) => r.json()).catch(() => null),
    fetch(`${AXIA}/api/ping`).then((r) => r.ok).catch(() => false),
  ]);
  $("#st").className = "st" + (site && analyser ? "" : " bad");
  $("#st").textContent = site && analyser ? "AxiA와 연결됨" : site ? "AI 분석기가 꺼져 있어요. AxiA_v2_open을 다시 실행해 주세요."
    : analyser ? "AxiA 사이트가 꺼져 있어요. 보내면 보관함에만 들어가요." : "AxiA가 꺼져 있어요. AxiA_v2_open을 실행해 주세요.";

  // Where right-click sends by default (★ in the menu).
  const projects = site ?? (await chrome.storage.local.get("projects")).projects ?? [];
  let { target } = await chrome.storage.local.get("target");
  target ??= projects[0]?.id ?? "lib";
  const sel = $("#target");
  for (const p of projects) sel.add(new Option(p.name, p.id, false, p.id === target));
  sel.add(new Option("보관함에만", "lib", false, target === "lib"));
  const syncSpec = () => { $("#spec").disabled = sel.value === "lib"; };
  syncSpec();
  sel.onchange = async () => { await chrome.storage.local.set({ target: sel.value }); chrome.runtime.sendMessage({ type: "POPUP_MENUS" }); syncSpec(); };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let info = null;
  try { info = await chrome.tabs.sendMessage(tab.id, { type: "AXIA_PAGE_INFO" }); } catch (e) {}
  $("#pick").disabled = !info;
  if (info?.isBoard) $("#board").hidden = false;
  $("#pick").onclick = () => { chrome.storage.local.set({ target: sel.value }); chrome.runtime.sendMessage({ type: "POPUP_PICK", tabId: tab.id }); window.close(); };
  $("#board").onclick = () => { chrome.runtime.sendMessage({ type: "POPUP_BOARD", tabId: tab.id, target: sel.value }); window.close(); };
  $("#spec").onclick = () => chrome.tabs.create({ url: `${SITE}/project/${sel.value}#step-spec` });
  $("#open").onclick = () => chrome.tabs.create({ url: site ? SITE : AXIA });

  // Recently sent, with their tags once the AI is done.
  const { recent = [] } = await chrome.storage.local.get("recent");
  if (!recent.length) return;
  const lib = await fetch(`${SITE}/api/library`).then((r) => r.json()).catch(() => null);
  const byId = new Map((lib?.items ?? []).map((e) => [e.id, e]));
  $("#recent").innerHTML = recent.slice(0, 6).map((r) => {
    const e = byId.get(r.id);
    const tags = !e ? "" : e.status === "tagged" ? e.tags.slice(0, 6).join(" · ") : e.status === "failed" ? "분석 실패" : "분석 중…";
    return `<li><img src="${e ? esc(e.thumb) : ""}" alt=""><div><small>${esc(r.name)}</small><span class="tags">${esc(tags)}</span></div></li>`;
  }).join("");
})();
