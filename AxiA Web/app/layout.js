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
      <head>
        {/* Adobe Fonts: New Frank 400/700 */}
        <link rel="stylesheet" href="https://use.typekit.net/bjk5ima.css" />
      </head>
      <body>
        <nav className="nav">
          <Link href="/" className="logo" aria-label="AxiA home">
            <svg viewBox="0 0 1000 532.7" height="16" fill="currentColor" aria-hidden="true">
              <path d="M1000,19.7V5c0-3.6-3.7-6-7-4.6l-484.8,217.3c-5.2,2.3-11.2,2.3-16.4,0L7,.4C3.7-1,0,1.4,0,5v49.6C0,59.7,2,64.7,5.5,68.4l253.1,265.1c4.4,4.6,3.4,12.1-2,15.4L4.7,504.5C1.8,506.3,0,509.6,0,513v14.7c0,3.6,3.7,6,7,4.6l484.8-217.3c5.2-2.3,11.2-2.3,16.4,0l484.8,217.3c3.3,1.5,7-.9,7-4.6v-49.6c0-5.1-2-10.1-5.5-13.8l-253.1-265.1c-4.4-4.6-3.4-12.1,2-15.4L995.3,28.2c2.9-1.8,4.7-5,4.7-8.5Z" />
            </svg>
          </Link>
          <div className="nav-menu glass">
            <Link href="/" className="btn logotype">AxiA</Link>
            <NavLink href="/reference" className="btn">Reference</NavLink>
            <NavLink href="/how" className="btn">About</NavLink>
            <Link href="#" className="btn primary">Sign In</Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
