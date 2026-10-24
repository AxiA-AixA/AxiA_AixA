import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "AxiA",
  description: "Collect scattered references and let AI organise them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap" />
      </head>
      <body>
        <nav className="nav">
          <Link href="/" className="logo">AxiA</Link>
          <Link href="/reference" className="btn">Reference</Link>
          <Link href="/lab" className="btn">Lab</Link>
          <Link href="#" className="btn primary">Sign In</Link>
          <Link href="/how" className="btn" aria-label="How AxiA works">?</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
