import Library from "./Library";

export const metadata = { title: "Library · AxiA" };

// Library: every reference with its tags; add references and your own tags (see Library.js).
// The analyser's own screen (API keys, re-analysis) opens from "Analyser settings".
export default function Page() {
  if (process.env.NEXT_PUBLIC_DEMO) {
    return (
      <section className="lab">
        <h1>Library</h1>
        <p>This is a view-only demo. Adding and analysing references works in the local version of AxiA; accounts are coming with the full release.</p>
      </section>
    );
  }
  return <Library />;
}
