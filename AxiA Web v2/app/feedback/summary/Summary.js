"use client";

import { useEffect, useState } from "react";

// The feedback in one place: averages, then every answer. "Copy for Google Sheets" copies the rows
// (tab-separated, same columns as the sheet's feedback tabs) to paste under the last row there.
const COLUMNS = {
  designer: [["at", "Date"], ["name", "Name"], ["role", "Role"], ["tried", "Tried"], ["easy", "Easy to use"], ["spec", "Spec matched"], ["use", "Would use"], ["worked", "What worked"], ["confusing", "What was confusing"], ["missing", "What's missing"]],
  client: [["at", "Date"], ["project", "Project"], ["name", "Name"], ["clear", "Brief was clear"], ["quick", "Answering was quick"], ["comment", "Comment"]],
};
const RATED = { designer: ["easy", "spec", "use"], client: ["clear", "quick"] };
const TITLES = { designer: "Designers", client: "Clients" };

const cell = (e, k) => (k === "at" ? e.at.slice(0, 16).replace("T", " ") : Array.isArray(e[k]) ? e[k].join(", ") : e[k] ?? "");
const avg = (list, k) => { const v = list.map((e) => e[k]).filter((x) => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"; };
const tsv = (kind, list) => list.map((e) => COLUMNS[kind].map(([k]) => String(cell(e, k)).replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n");
const csv = (kind, list) => [COLUMNS[kind].map(([, h]) => h), ...list.map((e) => COLUMNS[kind].map(([k]) => cell(e, k)))]
  .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

export default function Summary() {
  const [all, setAll] = useState(null);
  const [copied, setCopied] = useState("");
  useEffect(() => { fetch("/api/feedback").then((r) => r.json()).then(setAll).catch(() => setAll([])); }, []);
  if (!all) return <section className="feedback"><p className="muted">Loading…</p></section>;

  function copy(kind, list) {
    navigator.clipboard?.writeText(tsv(kind, list)).then(() => { setCopied(kind); setTimeout(() => setCopied(""), 1500); });
  }
  function download(kind, list) {
    const url = URL.createObjectURL(new Blob(["﻿" + csv(kind, list)], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `axia-feedback-${kind}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="feedback wide">
      <header className="page-head">
        <h1>Feedback summary</h1>
        <p>Designers answer at <a href="/feedback">/feedback</a>; clients answer after sending a brief. Copy the rows into the “피드백 디자이너” and “피드백 클라이언트” tabs of the axia-tech-validation sheet.</p>
      </header>
      {["designer", "client"].map((kind) => {
        const list = all.filter((e) => e.kind === kind).sort((a, b) => b.at.localeCompare(a.at));
        return (
          <div key={kind} className="feedback-block glass">
            <div className="row">
              <h2>{TITLES[kind]} <span className="muted">{list.length}</span></h2>
              <span className="grow" />
              <button className="btn" disabled={!list.length} onClick={() => copy(kind, list)}>{copied === kind ? "Copied" : "Copy for Google Sheets"}</button>
              <button className="btn" disabled={!list.length} onClick={() => download(kind, list)}>Download CSV</button>
            </div>
            <div className="averages">
              {RATED[kind].map((k) => (
                <div key={k}><b>{avg(list, k)}</b><span>{COLUMNS[kind].find(([c]) => c === k)[1]}</span></div>
              ))}
            </div>
            {list.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr>{COLUMNS[kind].map(([k, h]) => <th key={k}>{h}</th>)}</tr></thead>
                  <tbody>{list.map((e) => <tr key={e.id}>{COLUMNS[kind].map(([k]) => <td key={k}>{cell(e, k)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            ) : <p className="muted">No answers yet.</p>}
          </div>
        );
      })}
    </section>
  );
}
