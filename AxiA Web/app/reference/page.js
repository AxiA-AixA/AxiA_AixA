import Link from "next/link";
import { AXIA, syncAll } from "@/lib/axia";
import Lab from "./Lab";

export const metadata = { title: "Reference · AxiA" };
export const dynamic = "force-dynamic";

// The axia-prototype app (search, filters by field / source / tag, group views, detail edit,
// re-analyse, AI settings), shown as-is. Imported thumbnails are sent to it first.
export default async function Reference({ searchParams }) {
  const lab = (await searchParams).view === "lab";
  const tabs = (
    <div className="ref-tabs glass">
      <Link href="/reference" aria-current={lab ? undefined : "page"}>Library</Link>
      <Link href="/reference?view=lab" aria-current={lab ? "page" : undefined}>Lab</Link>
    </div>
  );
  if (lab) return <>{tabs}<Lab /></>;
  const up = await fetch(`${AXIA}/api/ping`, { cache: "no-store", signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok).catch(() => false);
  if (!up) {
    return (
      <section className="lab">
        {tabs}
        <h1>Reference</h1>
        <p>AI 분석기(axia-prototype)가 꺼져 있어요. axia-prototype 폴더의 Axia-실행-Mac.command를 열고 이 페이지를 새로고침하세요.</p>
      </section>
    );
  }
  syncAll();
  return <>{tabs}<iframe src="http://localhost:8770" className="reference" title="AxiA reference" /></>;
}
