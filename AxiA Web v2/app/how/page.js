import Lab from "./Lab";

export const metadata = { title: "About · AxiA" };

// The AxiA v2 pipeline (brief alignment), step by step. status: "done" = works in this test build,
// "next" = not built yet.
const steps = [
  {
    title: "Capture",
    body: "Right-click any image on Instagram, Pinterest or any site and send it to AxiA. Nothing depends on a platform's export or API.",
    items: [
      ["Chrome extension: right-click “Send to AxiA”", "done"],
      ["Whole Pinterest board in one go", "done"],
      ["Drag in files from your computer", "done"],
      ["Send straight into a project", "next"],
    ],
    out: `right-click → Send to AxiA
→ library (1 image, deduplicated)`,
    test: "Test 1",
  },
  {
    title: "Tag",
    body: "A vision model picks tags for every image from one fixed list. The same image always gets the same tags, so they can work as a shared standard.",
    items: [
      ["Fixed tag list (form, material, light, colour…)", "done"],
      ["Main colours of each image", "done"],
      ["Your own tags next to the fixed ones", "done"],
      ["Team Court: dispute a tag inside a project", "next"],
    ],
    out: `tags: ["Minimal", "Matte",
       "Diffused", "Muted"]`,
    test: "Test 3",
  },
  {
    title: "Spec",
    body: "Pick a project's references. AxiA writes what they have in common as a visual spec: what the client's word means for this project.",
    items: [
      ["Projects with their own references", "done"],
      ["Spec from shared tags (30% or more)", "done"],
      ["Turn points off, add notes and your own points", "done"],
      ["Spec in the designer's words (AI-written)", "next"],
    ],
    out: `"minimal" for Spring campaign
 · Whitespace   8 of 10
 · Diffused     7 of 10`,
    test: "Test 2",
  },
  {
    title: "Agree",
    body: "Share the spec as a link. The client agrees, isn't sure or disagrees, point by point, with comments. No sign-up.",
    items: [
      ["Client link, no account needed", "done"],
      ["Answers per point, shown in the project", "done"],
      ["Same link after updates", "done"],
      ["Check drafts against the agreed spec", "next"],
    ],
    out: `✓ Whitespace
✓ Diffused
? Muted  "a bit warmer?"`,
    test: "Test 2 · 4",
  },
];

const STATUS = { done: "Works", next: "Planned" };

export default function How() {
  return (
    <>
    <header className="brand">
      <svg viewBox="0 0 1000 383.7" fill="currentColor" role="img" aria-label="AxiA">
        <path d="M629.3,64.2c23,0,35.7-11.6,35.7-32.1S649.5,0,628.7,0s-35.1,14.2-35.1,32.6,9.2,31.6,35.7,31.6Z" />
        <path d="M856.2,12.1h-22.4l-139.6,350h-31.4V122.1h-194.7v21.1h29.3v3.2l-61.2,76.4-74.2-100.6h-62.7l102.3,132.6-84.2,107.4h-10L171.9,12.1h-22.4L0,383.7h34.7l42.7-113.7h130.3l40.4,113.7h89.4l82.5-107.4,80.5,107.4h218.3l42.7-113.7h130.3l40.4,113.7h67.6L856.2,12.1ZM87.9,241.7l57-142.7h1.7l52.5,142.7h-111.2ZM608,362.1h-61l-92.3-120,83-98.9h70.4v219ZM772,241.7l57.2-142.7h1.7l52.4,142.7h-111.2Z" />
      </svg>
      <p className="slogan">AxiA, one standard for visual language</p>
      <p className="concept">Designers and clients use the same words for different looks. AxiA reads your references with one fixed set of tags and turns them into a visual spec you both agree on, before the first draft.</p>
    </header>
    <section className="how">
      <h1>How AxiA works</h1>
      <p>Capture references from anywhere, tag them by one fixed standard, read a project&apos;s spec from what they share, and agree on it with your client.</p>

      <ol className="flow">
        {steps.map((s, i) => (
          <li key={s.title} className="step">
            <div className="step-head">
              <span className="step-no">{i + 1}</span>
              <h2>{s.title}</h2>
            </div>
            <p>{s.body}</p>
            <ul className="checks">
              {s.items.map(([label, status]) => (
                <li key={label}>
                  <span className={`pill ${status}`}>{STATUS[status]}</span>
                  {label}
                </li>
              ))}
            </ul>
            <pre>{s.out}</pre>
            <span className="step-test">{s.test}</span>
          </li>
        ))}
      </ol>

      <div className="legend">
        <span className="pill done">Works</span> In this test build
        <span className="pill next">Planned</span> Not built yet
      </div>

      <Figure />
    </section>
    <Lab />
    </>
  );
}

// Picture version of the same flow: any site → Send to AxiA → library → tags → agreed spec.
// Drawn with the page palette only (white, --grey, --black).
function Thumb({ x, y, s = 40 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={s} height={s} rx="4" fill="var(--grey)" />
      <circle cx={s * 0.7} cy={s * 0.3} r={s * 0.1} fill="var(--black)" />
      <path d={`M${s * 0.12} ${s * 0.82} L${s * 0.4} ${s * 0.45} L${s * 0.6} ${s * 0.68} L${s * 0.72} ${s * 0.56} L${s * 0.88} ${s * 0.82} Z`} fill="var(--black)" />
    </g>
  );
}

function Pill({ x, y, children }) {
  const w = children.length * 8 + 16;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height="20" rx="10" fill="var(--black)" />
      <text x={w / 2} y="14" textAnchor="middle" fontSize="12" fill="var(--white)">{children}</text>
    </g>
  );
}

function Figure() {
  const cols = [100, 300, 500, 700, 900];
  const labels = ["Any site", "Send to AxiA", "Library", "AI tags", "Agreed spec"];
  return (
    <svg className="figure" viewBox="0 0 1000 260" role="img"
      aria-label="Images from any site are sent to AxiA, kept in the library, tagged by AI, and become a spec the client ticks off">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--black)" />
        </marker>
      </defs>

      {/* 1. sources */}
      {["Instagram", "Pinterest", "Are.na"].map((name, i) => (
        <g key={name} transform={`translate(40 ${45 + i * 50})`}>
          <rect width="120" height="36" rx="18" fill="var(--grey)" />
          <text x="60" y="23" textAnchor="middle" fontSize="13">{name}</text>
        </g>
      ))}

      {/* 2. links */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(240 ${50 + i * 50})`}>
          <rect width="120" height="26" rx="13" fill="var(--white)" stroke="var(--black)" />
          <circle cx="16" cy="13" r="5" fill="none" stroke="var(--black)" strokeWidth="1.5" />
          <circle cx="24" cy="13" r="5" fill="none" stroke="var(--black)" strokeWidth="1.5" />
          <rect x="38" y="11" width={60 - i * 12} height="4" rx="2" fill="var(--black)" />
        </g>
      ))}

      {/* 3. thumbnails */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Thumb key={i} x={455 + (i % 2) * 50} y={45 + Math.floor(i / 2) * 50} />
      ))}

      {/* 4. tags */}
      {[["3D", "warm"], ["photo", "matte"], ["brand", "mono"]].map((tags, i) => (
        <g key={i}>
          <Thumb x={630} y={45 + i * 50} />
          <Pill x={678} y={45 + i * 50}>{tags[0]}</Pill>
          <Pill x={678} y={67 + i * 50}>{tags[1]}</Pill>
        </g>
      ))}

      {/* 5. agreed spec: a card of points, ticked by the client */}
      <rect x="820" y="40" width="170" height="140" rx="10" fill="var(--grey)" />
      {["Whitespace", "Diffused", "Matte", "Muted"].map((t, i) => (
        <g key={t} transform={`translate(836 ${62 + i * 30})`}>
          <circle cx="8" cy="0" r="8" fill={i < 3 ? "var(--black)" : "none"} stroke="var(--black)" />
          {i < 3 && <path d="M4 0l3 3 5-6" fill="none" stroke="var(--white)" strokeWidth="1.6" />}
          <text x="24" y="4" fontSize="12">{t}</text>
        </g>
      ))}

      {/* arrows + labels */}
      {[[172, 228], [372, 428], [560, 615], [755, 805]].map(([x1, x2]) => (
        <line key={x1} x1={x1} y1="110" x2={x2} y2="110" stroke="var(--black)" strokeWidth="1.5" markerEnd="url(#arrow)" />
      ))}
      {cols.map((x, i) => (
        <text key={x} x={x} y="228" textAnchor="middle" fontSize="15">{labels[i]}</text>
      ))}
    </svg>
  );
}
