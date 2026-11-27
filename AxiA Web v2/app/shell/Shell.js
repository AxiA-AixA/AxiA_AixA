"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AxiaSymbol } from "../Brand";
import { AboutIcon, FeedbackIcon, LibraryIcon, MapIcon, MoreIcon, ProjectsIcon, SettingsIcon } from "./icons";
import FeedbackSheet from "./FeedbackSheet";

// The app frame: one header row over the page. Always there: the AxiA symbol on its own, the three
// places and a ⋯ menu (feedback, about, analyser settings). Between them, the page's own tools
// (see HeadTools). The page has the whole window; a clicked image opens over it (.inspector).
// The client's brief (/brief/…) has no frame: it is their page, not the app.
export default function Shell({ children }) {
  const path = usePathname();
  if (path.startsWith("/brief/")) return <main className="bare">{children}</main>;
  return (
    <>
      <Header path={path} />
      <main className="page">{children}</main>
    </>
  );
}

const PLACES = [
  { href: "/map", label: "Map", Icon: MapIcon, on: (p) => p === "/map" },
  { href: "/", label: "Projects", Icon: ProjectsIcon, on: (p) => p === "/" || p.startsWith("/project/") },
  { href: "/library", label: "Library", Icon: LibraryIcon, on: (p) => p.startsWith("/library") },
];

function Header({ path }) {
  const [feedback, setFeedback] = useState(false);

  // ⌘K / Ctrl+K puts the cursor in the page's own search (the map's tag filter, the library search).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("page-search")?.focus(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="app-head">
      <Link href="/map" className="head-logo" aria-label="AxiA map"><AxiaSymbol height={15.6} /></Link>
      <nav className="head-tabs glass" aria-label="AxiA">
        {PLACES.map(({ href, label, Icon, on }) => (
          <Link key={href} href={href} aria-current={on(path) ? "page" : undefined}><Icon />{label}</Link>
        ))}
      </nav>
      <div id="head-tools" className="head-tools" />
      <details className="head-menu">
        <summary className="btn icon" aria-label="More" title="More"><MoreIcon /></summary>
        <div className="pop">
          <button type="button" className="pop-item" onClick={(e) => { e.currentTarget.closest("details").open = false; setFeedback(true); }}><FeedbackIcon />Feedback</button>
          <Link href="/how" className="pop-item"><AboutIcon />About AxiA</Link>
          <a href="http://localhost:8770" target="_blank" rel="noopener noreferrer" className="pop-item" title="API keys and re-analysis"><SettingsIcon />Analyser settings ↗</a>
        </div>
      </details>
      {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
    </header>
  );
}
