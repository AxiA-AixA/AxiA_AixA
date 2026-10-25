const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const api = (p, body) => fetch(p, body === undefined ? {} : {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)}).then(r => r.json());
const FIELD_NAMES = {"3d": "3D", graphic: "Graphic", typography: "Typography", painting: "Painting", photo: "Photo", package: "Package", video: "Video", ui_ux: "UI/UX", architecture: "Architecture", editorial: "Editorial", ai_image: "AI Image"};
const UNSORTED = "Unsorted";
const fk = f => FIELD_NAMES[f] || f || UNSORTED;
let L = {items: []}, view = "grid", filt = {state: "all", field: null, src: null, tag: null, q: ""}, lastSig = "";

async function load() {
  L = await api("/api/library");
  const sig = JSON.stringify([L.items.length, L.items.map(i => i.status + i.id).join(), L.queue]);
  const st = L.status || {};
  const busy = L.queue || st.working;
  $("#status").textContent = busy ? `Analysing · ${L.queue} waiting${st.note ? " · " + st.note : ""}` : `${L.items.length} references`;
  if (sig !== lastSig) { lastSig = sig; draw(); }
  setTimeout(load, busy ? 1500 : 5000);
}

function tagsOf(it) { return [...(it.user_tags || []), ...(it.tags || [])]; }
function fieldsOf(it) { return it.fields?.length ? it.fields : it.field ? [it.field] : []; }
function pass(it, skip) {
  if (skip !== "state") {
    if (filt.state === "queued" && !["queued", "retry", "new"].includes(it.status)) return false;
    if (filt.state === "failed" && it.status !== "failed") return false;
  }
  if (skip !== "field" && filt.field && !(fieldsOf(it).length ? fieldsOf(it) : [UNSORTED]).includes(filt.field)) return false;
  if (skip !== "src" && filt.src && it.source !== filt.src) return false;
  if (skip !== "tag" && filt.tag && !tagsOf(it).includes(filt.tag)) return false;
  if (filt.q) { const q = filt.q.toLowerCase(); if (!(tagsOf(it).join(" ") + " " + (it.title || "") + " " + (it.group_name || "") + " " + fieldsOf(it).join(" ")).toLowerCase().includes(q)) return false; }
  return true;
}
function counts(key, skip) {
  const c = {};
  L.items.filter(i => pass(i, skip)).forEach(i => [].concat(key(i)).forEach(k => c[k] = (c[k] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function nav(el, list, cur, set, label = x => x) {
  el.innerHTML = `<a class="${cur == null ? "on" : ""}" data-v="">All<span></span></a>` + list.map(([k, n]) => `<a class="${cur === k ? "on" : ""}" data-v="${esc(k)}">${esc(label(k))}<span>${n}</span></a>`).join("");
  el.querySelectorAll("a").forEach(a => a.onclick = () => { set(a.dataset.v || null); draw(); });
}

function draw() {
  const items = L.items.filter(i => pass(i));
  const q = L.items.filter(i => ["queued", "retry", "new"].includes(i.status)).length, f = L.items.filter(i => i.status === "failed").length;
  $("#navstate").innerHTML = [["all", "All", L.items.length], ["queued", "Waiting", q], ["failed", "Failed", f]].map(([k, l, n]) => `<a class="${filt.state === k ? "on" : ""}" data-v="${k}">${l}<span>${n}</span></a>`).join("");
  $("#navstate").querySelectorAll("a").forEach(a => a.onclick = () => { filt.state = a.dataset.v; draw(); });
  nav($("#navfield"), counts(i => fieldsOf(i).length ? fieldsOf(i) : UNSORTED, "field"), filt.field, v => filt.field = v, fk);
  nav($("#navsrc"), counts(i => i.source || "other", "src"), filt.src, v => filt.src = v);
  const tc = {};
  items.forEach(i => tagsOf(i).forEach(t => tc[t] = (tc[t] || 0) + 1));
  $("#navtags").innerHTML = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t, n]) => `<span class="${filt.tag === t ? "on" : ""}" data-t="${esc(t)}">${esc(t)} ${n}</span>`).join("") || '<span class="tags">None yet</span>';
  $("#navtags").querySelectorAll("[data-t]").forEach(s => s.onclick = () => { filt.tag = filt.tag === s.dataset.t ? null : s.dataset.t; draw(); });
  $("#count").textContent = `${items.length} shown`;

  if (!L.items.length) {
    $("#out").innerHTML = `<div class="empty"><p><b>No references yet.</b></p><p>In Chrome, right-click an image → <b>Send to Axia</b>.<br>On a Pinterest board: extension icon → <b>Send this whole board</b>.<br>Or paste a link above, or drop image files anywhere on this page.</p></div>`;
    return;
  }
  if (view === "grid") {
    $("#out").innerHTML = `<div class="grid">${items.map(card).join("")}</div>`;
  } else {
    const key = view === "group" ? (i => i.group_name || "(no group)") : (i => fieldsOf(i).length ? fieldsOf(i).map(fk) : fk(null));
    const g = {};
    items.forEach(i => [].concat(key(i)).forEach(k => (g[k] = g[k] || []).push(i)));  // an item with several types shows under each
    $("#out").innerHTML = Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, arr]) => `<div class="group"><h3>${esc(k)} <span>${arr.length}</span></h3><div class="groupgrid">${arr.map(i => `<img loading="lazy" src="/img/${i.file}" data-id="${i.id}">`).join("")}</div></div>`).join("");
  }
  document.querySelectorAll("[data-id]").forEach(el => el.onclick = () => openDetail(el.dataset.id));
}
function card(i) {
  const badge = i.status === "tagged" ? fieldsOf(i).map(f => `<span class="badge">${esc(fk(f))}</span>`).join("") : i.status === "failed" ? '<span class="badge f">Failed</span>' : '<span class="badge q">Analysing</span>';
  return `<div class="card" data-id="${i.id}"><img loading="lazy" src="/img/${i.file}"><div class="meta">${badge}<span class="src">${esc(i.source || "")}</span><div class="tags">${esc(tagsOf(i).slice(0, 6).join(" · "))}</div></div></div>`;
}

function openDetail(id) {
  const i = L.items.find(x => x.id === id);
  if (!i) return;
  const d = $("#detail");
  const fields = [...new Set([...(L.fields || []), ...fieldsOf(i)])];
  d.innerHTML = `<div class="dlg"><div class="pic"><img src="/img/${i.file}"></div><div class="side">
    <div class="row" style="justify-content:space-between"><b>${esc(i.title || "Untitled")}</b><button class="ghost" id="dclose">Close ×</button></div>
    ${i.page_url ? `<p class="tags"><a href="${esc(i.page_url)}" target="_blank" rel="noopener">Open source (${esc(i.source)}) ↗</a></p>` : ""}
    ${i.status === "failed" ? `<div class="note">Analysis failed: ${esc(i.error || "")}</div>` : ""}
    <label>Project type (up to 3)</label><div class="row">${fields.map(f => `<label class="row" style="margin:0;font-size:14px;color:var(--black)"><input type="checkbox" data-f="${esc(f)}" style="width:auto" ${fieldsOf(i).includes(f) ? "checked" : ""}>${esc(fk(f))}</label>`).join("")}</div>
    <label>AI tags</label><div class="chips">${(i.tags || []).map(t => `<span data-t="${esc(t)}">${esc(t)}</span>`).join("") || '<span class="tags">None</span>'}</div>
    <label>My tags (comma separated)</label><input id="dtags" value="${esc((i.user_tags || []).join(", "))}">
    <label>Group</label><input id="dgroup" value="${esc(i.group_name || "")}">
    <p class="tags" style="margin-top:14px">Added ${esc(i.added)}${i.model ? ` · ${esc(i.model)} · ${i.latency_ms}ms` : ""}</p>
    <div class="row" style="margin-top:14px"><button class="primary" id="dsave">Save</button><button id="dretag">Re-analyse</button><button class="ghost" id="ddel" style="color:var(--bad)">Delete</button></div>
  </div></div>`;
  d.showModal();
  $("#dclose").onclick = () => d.close();
  d.querySelectorAll(".chips [data-t]").forEach(s => s.onclick = () => { filt.tag = s.dataset.t; d.close(); draw(); });
  $("#dsave").onclick = async () => { await api("/api/item", {id, fields: [...d.querySelectorAll("[data-f]:checked")].map(x => x.dataset.f), user_tags: $("#dtags").value.split(",").map(s => s.trim()).filter(Boolean), group_name: $("#dgroup").value}); d.close(); lastSig = ""; load(); };
  $("#dretag").onclick = async () => { await api("/api/retag", {ids: [id]}); d.close(); lastSig = ""; };
  $("#ddel").onclick = async () => { if (confirm("Delete this reference from Axia?")) { await api("/api/item", {id, delete: true}); d.close(); lastSig = ""; } };
}

// ---- adding ----
async function addLink(url) {
  $("#status").textContent = "Fetching…";
  const r = await api("/api/add_link", {url});
  $("#status").textContent = r.error ? "Couldn't add: " + r.error : `${r.added} added (${r.new} new)`;
  lastSig = "";
}
$("#addlink").onclick = () => { const v = $("#link").value.trim(); if (v) { addLink(v); $("#link").value = ""; } };
$("#link").onkeydown = e => { if (e.key === "Enter") $("#addlink").click(); };
$("#pick").onclick = () => $("#files").click();
$("#files").onchange = e => uploadFiles(e.target.files);
async function uploadFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    $("#status").textContent = `Uploading ${++n}/${files.length}`;
    await fetch("/api/upload?name=" + encodeURIComponent(f.name), {method: "POST", body: f});
  }
  lastSig = "";
}
$("#pickjson").onclick = () => $("#jsonfile").click();
$("#jsonfile").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  $("#status").textContent = "Importing Instagram JSON… (a large file can take a few minutes)";
  const r = await api("/api/import_json", JSON.parse(await f.text()));
  $("#status").textContent = r.error ? r.error : `${r.added} added (${r.new} new, ${r.failed} failed — usually expired thumbnail links)`;
  lastSig = "";
};
document.addEventListener("dragover", e => { e.preventDefault(); document.body.classList.add("drag"); });
document.addEventListener("dragleave", e => { if (!e.relatedTarget) document.body.classList.remove("drag"); });
document.addEventListener("drop", e => {
  e.preventDefault(); document.body.classList.remove("drag");
  if (e.dataTransfer.files.length) return uploadFiles(e.dataTransfer.files);
  const url = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").split("\n")[0].trim();
  if (url) addLink(url);
});

// ---- view / search ----
document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { view = b.dataset.v; document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x === b)); draw(); });
$("#q").oninput = e => { filt.q = e.target.value.trim(); draw(); };

// ---- settings ----
let chain = [];
async function openSettings() {
  const s = await api("/api/settings");
  chain = s.chain;
  drawChain();
  ["gemini", "anthropic", "openai"].forEach(p => { $("#k_" + p).value = ""; $("#ks_" + p).textContent = s.keys[p] ? "Saved" : "None"; });
  $("#mode").value = s.mode; $("#auto").checked = s.auto_tag;
  $("#settings").showModal();
}
function drawChain() {
  $("#chain").innerHTML = chain.map((c, i) => `<div class="chain" data-i="${i}"><b>${i + 1}</b><select data-k="provider">${["gemini", "anthropic", "openai", "mock"].map(p => `<option ${p === c.provider ? "selected" : ""}>${p}</option>`).join("")}</select><input data-k="model" value="${esc(c.model)}"><div><button class="ghost" data-up>↑</button><button class="ghost" data-del>×</button></div></div>`).join("");
  $("#chain").querySelectorAll(".chain").forEach(row => {
    const i = +row.dataset.i;
    row.querySelectorAll("[data-k]").forEach(el => el.oninput = () => chain[i][el.dataset.k] = el.value);
    row.querySelector("[data-up]").onclick = () => { if (i) { [chain[i - 1], chain[i]] = [chain[i], chain[i - 1]]; drawChain(); } };
    row.querySelector("[data-del]").onclick = () => { chain.splice(i, 1); drawChain(); };
  });
}
$("#addstep").onclick = () => { chain.push({provider: "gemini", model: ""}); drawChain(); };
$("#opensettings").onclick = openSettings;
$("#closeset").onclick = () => $("#settings").close();
$("#saveset").onclick = async () => {
  const keys = {};
  ["gemini", "anthropic", "openai"].forEach(p => { const v = $("#k_" + p).value.trim(); if (v) keys[p] = v; });
  await api("/api/settings", {chain: chain.filter(c => c.model), keys, mode: $("#mode").value, auto_tag: $("#auto").checked});
  $("#settings").close();
};
$("#retryfail").onclick = async () => { const r = await api("/api/retag", {statuses: ["failed", "new"]}); $("#settings").close(); $("#status").textContent = `Re-analysing ${r.queued}`; lastSig = ""; };

load();
