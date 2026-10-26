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
          <div className="nav-menu glass">
            <NavLink href="/reference" className="btn">Reference</NavLink>
            <NavLink href="/lab" className="btn">Lab</NavLink>
            <NavLink href="/how" className="btn">About</NavLink>
            <Link href="#" className="btn primary">Sign In</Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
