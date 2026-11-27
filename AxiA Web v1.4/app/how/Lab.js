// Validation plan for v2 (8 weeks, 15 designers on real client projects). See "Axia 전략 수정안 v2".
const tests = [
  { n: 1, title: "Capture: extension use in real projects", goal: "8 of 15 still sending references after 4 weeks" },
  { n: 2, title: "Client link: do clients open and answer?", goal: "60% of briefs answered" },
  { n: 3, title: "Fixed tags as a shared standard", goal: "Disputed points per brief, and why" },
  { n: 4, title: "Fewer revision rounds", goal: "At least 1 round fewer than the designer's baseline" },
  { n: 5, title: "Would you miss it?", goal: "40% say they'd be disappointed without AxiA" },
  { n: 6, title: "Pricing interviews", goal: "3 agree to a paid plan" },
];

// Lab: the test list, shown under the About description.
export default function Lab() {
  return (
    <section className="lab" id="lab">
      <h1>Lab</h1>
      <p>Tests for v2. Results go in the “v2 판정” and “v2 참가자” tabs of the axia-tech-validation sheet.</p>
      <ul className="tests">
        {tests.map((t) => (
          <li key={t.n}>
            <h2>Test {t.n}. {t.title}</h2>
            <span>Goal: {t.goal} · not started</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
