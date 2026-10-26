export const metadata = { title: "About · AxiA" };

// The AxiA pipeline, step by step. status: "done" = works in this test build,
// "next" = not built yet.
const steps = [
  {
    title: "가져오기",
    en: "Import",
    body: "인스타그램·핀터레스트·Are.na에 저장한 게시물을 가져와요.",
    items: [
      ["링크 붙여넣기 · JSON 파일", "done"],
      ["인스타그램 '내 정보 다운로드' 파일", "done"],
      ["크롬 확장 (우클릭 저장, 저장 페이지 읽기)", "next"],
      ["핀터레스트·Are.na 계정 연결", "next"],
    ],
    out: `instagram.com/p/C1x…
pinterest.com/pin/112…
are.na/block/301…`,
    test: "Test 1 · 2",
  },
  {
    title: "썸네일 가져오기",
    en: "Preview",
    body: "각 게시물 페이지를 열어 대표 이미지(og:image)와 제목을 찾고, 썸네일만 저장해요. 원본 이미지는 저장하지 않아요.",
    items: [
      ["페이지에서 썸네일·제목 찾기", "done"],
      ["썸네일 파일로 저장 (만료 대비)", "done"],
      ["썸네일 리사이즈 (300px)", "next"],
    ],
    out: `{ title: "Studio A — Spring",
  image: "thumb/2ab0….jpg" }`,
    test: "Test 4",
  },
  {
    title: "AI 분석 · 태그",
    en: "Tagging",
    body: "비전 모델이 썸네일을 보고 정해진 태그 목록 안에서 태그를 붙여요. 같은 이미지엔 늘 같은 태그가 나와야 해요.",
    items: [
      ["분야: 3D · 브랜딩 · 포토 · 그래픽 …", "next"],
      ["스타일 · 무드 · 색 · 소재", "next"],
      ["그룹 이름 (AI가 정함)", "next"],
      ["태그에 없는 말로 찾기 (임베딩)", "next"],
    ],
    out: `field: "3d"
tags: ["warm", "matte",
       "low-saturation"]`,
    test: "Test 3 · 5",
  },
  {
    title: "AxiA에서 보기",
    en: "Board",
    body: "저장된 레퍼런스가 관계 지도와 그리드로 정리돼요. 썸네일을 누르면 원래 게시물로 가요.",
    items: [
      ["네트워크 그래프 (확대·호버로 썸네일)", "done"],
      ["새로고침해도 유지되는 저장", "done"],
      ["분류 기준: 플랫폼별", "done"],
      ["분류 기준: 태그별 · 분야별", "next"],
      ["태그 안에서 그리드로 찾기", "next"],
    ],
    out: `● ── instagram.com
│     ● ●
● ── warm ── ● matte`,
    test: "Test 6 · 7",
  },
];

const STATUS = { done: "작동", next: "예정" };

export default function How() {
  return (
    <section className="how">
      <h1>AxiA는 이렇게 작동해요</h1>
      <p>흩어진 저장 게시물을 한곳으로 모으고, AI가 같은 기준으로 태그를 붙여 관계 지도로 보여줘요.</p>

      <ol className="flow">
        {steps.map((s, i) => (
          <li key={s.en} className="step">
            <div className="step-head">
              <span className="step-no">{i + 1}</span>
              <h2>{s.title} <small>{s.en}</small></h2>
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
        <span className="pill done">작동</span> 지금 테스트 버전에서 동작
        <span className="pill next">예정</span> 아직 만들지 않음
      </div>

      <Figure />
    </section>
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
  const labels = ["저장 게시물", "링크", "썸네일", "AI 태그", "AxiA"];
  const dots = [[860, 70], [905, 50], [950, 85], [880, 140], [945, 150], [835, 115], [965, 120], [905, 175]];
  return (
    <svg className="figure" viewBox="0 0 1000 260" role="img"
      aria-label="저장 게시물이 링크, 썸네일, AI 태그를 거쳐 AxiA 그래프가 되는 흐름">
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
