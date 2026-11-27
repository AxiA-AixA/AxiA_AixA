"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AxiaLogotype, AxiaSymbol } from "../Brand";
import { AboutIcon, FeedbackIcon, LibraryIcon, MapIcon, ProjectsIcon, SearchIcon, SettingsIcon } from "./icons";
import FeedbackSheet from "./FeedbackSheet";

// The app frame, laid out like Figma's file browser: a fixed sidebar (logo, search, the three places,
// recent projects; feedback and settings at the bottom) and the page beside it.
// The client's brief (/brief/…) has no frame: it is their page, not the app.
export default function Shell({ children }) {
  const path = usePathname();
  if (path.startsWith("/brief/")) return <main className="bare">{children}</main>;
  return (
    <>
      <Sidebar path={path} />
      <main className="page">{children}</main>
    </>
  );
}

const PLACES = [
  { href: "/map", label: "Map", Icon: MapIcon, on: (p) => p === "/map" },
  { href: "/", label: "Projects", Icon: ProjectsIcon, on: (p) => p === "/" || p.startsWith("/project/") },
  { href: "/library", label: "Library", Icon: LibraryIcon, on: (p) => p.startsWith("/library") },
];

function Sidebar({ path }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState([]);
  const [feedback, setFeedback] = useState(false);
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json())
      .then((list) => setRecent([...list].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 6)))
      .catch(() => {});
  }, [path]); // new or renamed projects show after moving between pages

  // ⌘K / Ctrl+K puts the cursor in the search field.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("side-search")?.focus(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className="sidebar" aria-label="AxiA">
      <Link href="/map" className="side-logo" aria-label="AxiA map"><AxiaSymbol height={13} /><AxiaLogotype height={12} /></Link>
      <form className="side-search" role="search" onSubmit={(e) => { e.preventDefault(); router.push(`/library?q=${encodeURIComponent(q.trim())}`); dispatchEvent(new CustomEvent("axia-search", { detail: q.trim() })); setQ(""); }}>
        <SearchIcon />
        <input id="side-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search references" aria-label="Search references in the library" />
        <kbd>⌘K</kbd>
      </form>
      <nav className="side-nav">
        {PLACES.map(({ href, label, Icon, on }) => (
          <Link key={href} href={href} className="side-item" aria-current={on(path) ? "page" : undefined}><Icon />{label}</Link>
        ))}
      </nav>
      {recent.length > 0 && (
        <div className="side-section">
          <p className="side-head">Recent projects</p>
          {recent.map((p) => (
            <Link key={p.id} href={`/project/${p.id}`} className="side-item small" aria-current={path === `/project/${p.id}` ? "page" : undefined} title={p.name}>
              <span className="side-dot" aria-hidden="true" />{p.name}
            </Link>
          ))}
        </div>
      )}
      <div className="side-bottom">
        <button type="button" className="side-item" onClick={() => setFeedback(true)}><FeedbackIcon />Feedback</button>
        <Link href="/how" className="side-item" aria-current={path === "/how" ? "page" : undefined}><AboutIcon />About AxiA</Link>
        <a href="http://localhost:8770" target="_blank" rel="noopener noreferrer" className="side-item" title="API keys and re-analysis"><SettingsIcon />Analyser settings ↗</a>
      </div>
      {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
    </aside>
  );
}
