import Nav from "./Nav";
import "./globals.css";
import "./brand.css";
import "./flow.css";

export const metadata = {
  title: "AxiA",
  description: "Turn references into one visual spec you and your client agree on.",
  robots: { index: false, follow: false }, // test build with other people's work as references
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: browser dark-mode tools add classes to these tags before React loads
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Adobe Fonts: New Frank 400/700 */}
        <link rel="stylesheet" href="https://use.typekit.net/bjk5ima.css" suppressHydrationWarning />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
