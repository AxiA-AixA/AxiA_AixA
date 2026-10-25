import Link from "next/link";
import NavLink from "./NavLink";
import "./globals.css";

export const metadata = {
  title: "AxiA",
  description: "Collect scattered references and let AI organise them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="logo">AxiA</Link>
          <NavLink href="/reference" className="btn">Reference</NavLink>
          <NavLink href="/lab" className="btn">Lab</NavLink>
          <Link href="#" className="btn primary">Sign In</Link>
          <NavLink href="/how" className="btn" aria-label="How AxiA works">?</NavLink>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
