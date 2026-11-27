import Lab from "./Lab";

export const metadata = { title: "About · AxiA" };

// The AxiA pipeline, step by step. status: "done" = works in this test build,
// "next" = not built yet.
const steps = [
  {
    title: "Import",
    body: "Bring in the posts you saved on Instagram, Pinterest and Are.na.",
    items: [
      ["Paste links · JSON file", "done"],
      ["Instagram 'Download your information' file", "done"],
      ["Chrome extension (right-click to save, read saved pages)", "next"],
      ["Connect Pinterest and Are.na accounts", "next"],
    ],
    out: `instagram.com/p/C1x…
pinterest.com/pin/112…
are.na/block/301…`,
    test: "Test 1 · 2",
  },
  {
    title: "Preview",
    body: "Open each post's page, find its main image (og:image) and title, and keep only a thumbnail. Original images aren't stored.",
    items: [
      ["Find thumbnail and title on the page", "done"],
      ["Save thumbnails as files (links expire)", "done"],
      ["Resize thumbnails (300px)", "next"],
    ],
    out: `{ title: "Studio A — Spring",
  image: "thumb/2ab0….jpg" }`,
    test: "Test 4",
  },
  {
    title: "Tagging",
    body: "A vision model looks at each thumbnail and picks tags from a fixed tag list. The same image should always get the same tags.",
    items: [
      ["Project type: 3D · Branding · Photo · Graphic …", "next"],
      ["Style · mood · colour · material", "next"],
      ["Group names (chosen by the AI)", "next"],
      ["Search with words that aren't tags (embeddings)", "next"],
    ],
    out: `field: "3d"
tags: ["warm", "matte",
       "low-saturation"]`,
    test: "Test 3 · 5",
  },
  {
    title: "Board",
    body: "Your saved references are laid out as a relationship map and a grid. Click a thumbnail to go to the original post.",
    items: [
      ["Network graph (thumbnails on zoom and hover)", "done"],
      ["Storage that survives a refresh", "done"],
      ["Group by platform", "done"],
      ["Group by tag · project type", "next"],
      ["Browse a tag as a grid", "next"],
    ],
    out: `● ── instagram.com
│     ● ●
● ── warm ── ● matte`,
    test: "Test 6 · 7",
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
      <p className="slogan">AxiA, every reference in relation</p>
      <p className="concept">AxiA weaves scattered references into relationships, turning taste that words could never settle into a standard people can see together.</p>
    </header>
    <section className="how">
      <h1>How AxiA works</h1>
      <p>AxiA gathers your scattered saved posts in one place, tags them by the same rules with AI, and shows them as a relationship map.</p>

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

// Picture version of the same flow: saved posts → links → thumbnails → tags → graph.
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
  const labels = ["Saved posts", "Links", "Thumbnails", "AI tags", "AxiA"];
  const dots = [[860, 70], [905, 50], [950, 85], [880, 140], [945, 150], [835, 115], [965, 120], [905, 175]];
  return (
    <svg className="figure" viewBox="0 0 1000 260" role="img"
      aria-label="Saved posts become links, then thumbnails, then AI tags, and finally the AxiA graph">
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

      {/* 5. graph */}
      {dots.map(([x, y], i) => (
        <line key={i} x1="905" y1="105" x2={x} y2={y} stroke="var(--black)" strokeOpacity="0.25" />
      ))}
      {dots.map(([x, y], i) => (
        i % 2 ? <Thumb key={i} x={x - 14} y={y - 14} s={28} /> : <circle key={i} cx={x} cy={y} r="6" fill="var(--black)" />
      ))}
      <circle cx="905" cy="105" r="9" fill="var(--black)" />
      <circle cx="905" cy="105" r="15" fill="none" stroke="var(--black)" />

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
