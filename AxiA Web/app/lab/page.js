export const metadata = { title: "Lab · AxiA" };

const tests = [
  { n: 1, title: "Instagram saved import & auto sync" },
  { n: 2, title: "Import scope per platform" },
  { n: 3, title: "AI tag & group name consistency" },
  { n: 4, title: "Analysis time, cost, storage", owner: "Haram" },
  { n: 5, title: "Search with words not in tags", owner: "Boogeun" },
  { n: 6, title: "Graph vs grid usability" },
  { n: 7, title: "Designer & client interviews" },
];

export default function Lab() {
  return (
    <section>
      <h1>Lab</h1>
      <p>Test 1–7. Each test gets its own page here when it starts.</p>
      <ul className="tests">
        {tests.map((t) => (
          <li key={t.n}>
            <h2>Test {t.n}. {t.title}</h2>
            <span>{t.owner ?? "Owner TBD"} · not started</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
