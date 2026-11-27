"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLink from "./NavLink";
import { AxiaLogotype, AxiaSymbol } from "./Brand";

// Header. Hidden on /brief/…: the client's page carries no app navigation.
export default function Nav() {
  const path = usePathname();
  if (path.startsWith("/brief/")) return null;
  return (
    <nav className="nav">
      <Link href="/map" className="logo" aria-label="AxiA map">
        <AxiaSymbol height={16} />
      </Link>
      <div className="nav-menu glass">
        <Link href="/map" className="btn logotype" aria-label="AxiA map" aria-current={path === "/map" ? "page" : undefined}><AxiaLogotype height={11} /></Link>
        <NavLink href="/" className="btn" current={path === "/" || path.startsWith("/project/")}>Projects</NavLink>
        <NavLink href="/library" className="btn">Library</NavLink>
        <NavLink href="/how" className="btn">About</NavLink>
        <NavLink href="/feedback" className="btn" current={path.startsWith("/feedback")}>Feedback</NavLink>
      </div>
    </nav>
  );
}
