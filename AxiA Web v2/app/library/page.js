import { AXIA } from "@/lib/axia";

export const metadata = { title: "Library · AxiA" };
export const dynamic = "force-dynamic";

// The axia-prototype app (add, search, filter, edit tags, re-analyse, AI settings), shown as-is.
// The Library tab in v2 (the v1 Reference page: add links and files).
export default async function Library() {
  if (process.env.NEXT_PUBLIC_DEMO) {
    return (
      <section className="lab">
        <h1>Library</h1>
        <p>This is a view-only demo. Adding and analysing references works in the local version of AxiA; accounts are coming with the full release.</p>
      </section>
    );
  }
  const up = await fetch(`${AXIA}/api/ping`, { cache: "no-store", signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok).catch(() => false);
  if (!up) {
    return (
      <section className="lab">
        <h1>Library</h1>
        <p>AI 분석기(axia-prototype)가 꺼져 있어요. axia-prototype 폴더의 Axia-실행-Mac.command(Windows는 Axia-실행-Windows.bat)를 열고 이 페이지를 새로고침하세요.</p>
      </section>
    );
  }
  return <iframe src="http://localhost:8770" className="reference" title="AxiA reference" />;
}
