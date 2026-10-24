import { AXIA, syncAll } from "@/lib/axia";

export const metadata = { title: "Library · AxiA" };
export const dynamic = "force-dynamic";

// The axia-prototype app (search, filters by field / source / tag, group views, detail edit,
// re-analyse, AI settings), shown as-is. Imported thumbnails are sent to it first.
export default async function Library() {
  const up = await fetch(`${AXIA}/api/ping`, { cache: "no-store", signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok).catch(() => false);
  if (!up) {
    return (
      <section>
        <h1>Library</h1>
        <p>AI 분석기(axia-prototype)가 꺼져 있어요. axia-prototype 폴더의 Axia-실행-Mac.command를 열고 이 페이지를 새로고침하세요.</p>
      </section>
    );
  }
  syncAll();
  return <iframe src="http://localhost:8770" className="library" title="AxiA library" />;
}
