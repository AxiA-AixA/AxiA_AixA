// Visual spec: what a project's references have in common, read from their fixed AI tags.
// Shared by the server (API) and the browser (project page), so no Node imports here.

// Tag categories, same order and groups as axia-prototype/tags.txt. Keep in step with that file.
export const CATEGORIES = [
  ["Form", "Minimal Maximal Geometric Organic Abstract Figurative Symbol Branding Symmetrical Asymmetrical Grid Modular Layered Whitespace Dense Centered Offset Repetition Pattern"],
  ["Material", "Photorealistic Glossy Matte Metallic Glass Translucent Liquid Squishy Fabric Plastic Paper Grain Noise Iridescent Chrome"],
  ["Light", "Diffused Harsh Studio Rimlit Volumetric Neon Backlit Airy Shadowy"],
  ["Colour", "Monochrome Duotone Pastel Vivid Muted Dark Warm Cool Gradient Grayscale"],
  ["Palette", "White Grey Gray Black Red Orange Yellow Green Blue Purple Pink Brown Beige Cream Navy Teal Gold Silver"],
  ["Type & layout", "Typographic Serif Sans Display Kinetic Editorial Poster Book Magazine Swiss Brutalist Collage"],
  ["3D", "Render Product Character Environment Simulation Procedural Lowpoly Clay"],
  ["Motion", "Motion Titles Loop Transition Camerawork Slowmo Stopmotion Footage Music Commercial"],
  ["AI image", "Generative Surreal Dreamlike Hyperreal Uncanny"],
  ["Mood", "Calm Energetic Playful Futuristic Retro Nostalgic Luxurious Industrial Natural Clinical"],
].map(([name, tags]) => [name, tags.split(" ")]);

const FIXED = new Set(CATEGORIES.flatMap(([, tags]) => tags.map((t) => t.toLowerCase())));
export const isFixedTag = (w) => FIXED.has(String(w).toLowerCase());
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

const CATEGORY_OF = new Map(CATEGORIES.flatMap(([name, tags]) => tags.map((t) => [t.toLowerCase(), name])));
export const categoryOf = (tag) => CATEGORY_OF.get(tag.toLowerCase()) ?? "Other";

// Plain-language reading of some tags, shown under the tag in the spec (what a client reads).
export const MEANING = {
  Minimal: "few elements, nothing decorative",
  Whitespace: "generous empty space around the subject",
  Dense: "lots of elements, little empty space",
  Centered: "subject in the middle of the frame",
  Offset: "subject placed off-centre",
  Grid: "laid out on a clear grid",
  Matte: "no shine on surfaces",
  Glossy: "shiny, reflective surfaces",
  Diffused: "soft light, soft shadows",
  Harsh: "hard light, crisp shadows",
  Studio: "controlled studio lighting",
  Airy: "bright, light tones overall",
  Shadowy: "mostly dark, strong shadows",
  Muted: "low saturation, toned-down colour",
  Vivid: "strong, saturated colour",
  Pastel: "soft, light colours",
  Monochrome: "one colour in different shades",
  Grayscale: "black and white, no colour",
  Warm: "reds, oranges, yellows lead",
  Cool: "blues and greens lead",
  Sans: "sans-serif type",
  Serif: "serif type",
  Typographic: "type is the main element",
  Calm: "quiet, unhurried feel",
  Luxurious: "premium, high-end feel",
  Futuristic: "forward-looking, tech feel",
  Retro: "looks back to an earlier era",
};

// Default thresholds: a tag goes in the spec when at least SHARE of the references have it
// (and at least MIN_COUNT of them), up to PER_CATEGORY tags per category.
export const SHARE = 0.3;
const MIN_COUNT = 2;
const PER_CATEGORY = 3;

// refs: library entries in the project. edits: { [tag]: { off, note } } from the designer.
// custom: [{ key, text }] points the designer added by hand. word: the client's words for the look;
// those that aren't fixed tags were checked by the AI on each reference (entry.words) and become
// points like tags do, under "Client's words".
// Returns [{ key, tag, category, count, share, examples: [file], meaning, note, off, custom }].
export function buildSpec(refs, edits = {}, custom = [], word = "") {
  const n = refs.length;
  const counts = new Map();
  for (const r of refs) {
    for (const t of new Set([...r.tags, ...(r.colors ?? [])])) {
      const c = counts.get(t) ?? { count: 0, files: [] };
      c.count++;
      if (c.files.length < 4) c.files.push(r.file);
      counts.set(t, c);
    }
  }
  const byCat = new Map();
  for (const [tag, c] of counts) {
    if (c.count < Math.min(MIN_COUNT, n) || c.count / n < SHARE) continue;
    const category = categoryOf(tag);
    if (category === "Other") continue;
    if (!byCat.has(category)) byCat.set(category, []);
    byCat.get(category).push({ key: tag, tag, category, count: c.count, share: c.count / n, examples: c.files });
  }
  const items = [];
  for (const [category] of CATEGORIES) {
    const list = (byCat.get(category) ?? []).sort((a, b) => b.count - a.count).slice(0, PER_CATEGORY);
    items.push(...list);
  }
  for (const w of clientWords(word)) {
    const yes = refs.filter((r) => r.words?.[w] === true);
    if (yes.length < Math.min(MIN_COUNT, n) || yes.length / n < SHARE) continue;
    items.push({ key: `word:${w}`, tag: cap(w), category: WORDS_CATEGORY, count: yes.length, share: yes.length / n, examples: yes.slice(0, 4).map((r) => r.file), word: true });
  }
  for (const it of items) {
    it.meaning = it.word ? "your client's word, checked by AI on each reference" : MEANING[it.tag] ?? "";
    it.note = edits[it.key]?.note ?? "";
    // Supporting points (seen in under 60% of references) start switched off, so only what most
    // references share goes to the client unless the designer turns more on.
    it.off = edits[it.key]?.off ?? it.share < CLEAR;
  }
  for (const c of custom) {
    items.push({ key: c.key, tag: c.text, category: "Added by designer", count: 0, share: 0, examples: [], meaning: "", note: edits[c.key]?.note ?? "", off: !!edits[c.key]?.off, custom: true });
  }
  return items;
}

// Latest client answer per spec item: { [key]: { vote, comment, name, at } }.
export function latestVotes(responses = []) {
  const out = {};
  for (const r of responses) for (const [key, v] of Object.entries(r.items ?? {})) {
    if (v.vote || v.comment) out[key] = { ...v, name: r.name, at: r.at };
  }
  return out;
}

export const VOTES = {
  agree: { label: "Agree", mark: "✓" },
  unsure: { label: "Not sure", mark: "?" },
  disagree: { label: "Disagree", mark: "✕" },
};

// ---------- Reading the spec in plain words ----------

// A point is "clear" when most references share it; below that it is supporting evidence only.
export const CLEAR = 0.6;
export const strength = (it) => (it.custom ? "clear" : it.share >= CLEAR ? "clear" : "some");

// Words clients use for a look, and the fixed tags that usually show it. Used to check whether
// the references actually look like what the client said. Grow this list from real briefs.
export const WORD_HINTS = {
  minimal: ["Minimal", "Whitespace", "Monochrome"], minimalist: ["Minimal", "Whitespace"], clean: ["Minimal", "Whitespace", "Grid", "Sans"],
  simple: ["Minimal", "Whitespace"], modern: ["Sans", "Minimal", "Geometric"], bold: ["Vivid", "Display", "Dense"],
  energetic: ["Energetic", "Vivid", "Kinetic", "Motion"], dynamic: ["Energetic", "Kinetic", "Motion", "Asymmetrical"],
  romantic: ["Pastel", "Dreamlike", "Diffused", "Warm"], soft: ["Pastel", "Diffused", "Airy"], dreamy: ["Dreamlike", "Pastel", "Diffused"],
  calm: ["Calm", "Muted", "Airy"], quiet: ["Calm", "Muted", "Whitespace"], playful: ["Playful", "Vivid", "Organic"],
  fresh: ["Airy", "Vivid", "Natural", "Cool"], bright: ["Airy", "Vivid"], warm: ["Warm"], cool: ["Cool"], dark: ["Dark", "Shadowy"],
  premium: ["Luxurious", "Studio", "Dark", "Metallic"], luxury: ["Luxurious", "Studio", "Metallic"], luxurious: ["Luxurious", "Metallic"],
  elegant: ["Luxurious", "Serif", "Minimal"], futuristic: ["Futuristic", "Chrome", "Glass", "Metallic"], techy: ["Futuristic", "Chrome", "Glass"],
  natural: ["Natural", "Organic", "Warm"], organic: ["Organic", "Natural"], retro: ["Retro", "Nostalgic", "Grain"], vintage: ["Retro", "Nostalgic", "Grain"],
  editorial: ["Editorial", "Serif", "Grid"], industrial: ["Industrial", "Metallic", "Harsh"], surreal: ["Surreal", "Dreamlike"],
  "미니멀": ["Minimal", "Whitespace"], "깔끔": ["Minimal", "Whitespace", "Grid"], "고급": ["Luxurious", "Studio", "Metallic"],
  "럭셔리": ["Luxurious", "Metallic"], "따뜻": ["Warm"], "차분": ["Calm", "Muted"], "밝은": ["Airy", "Vivid"], "부드러운": ["Pastel", "Diffused"],
  "몽환": ["Dreamlike", "Pastel"], "미래": ["Futuristic", "Chrome"], "자연": ["Natural", "Organic"], "레트로": ["Retro", "Nostalgic"],
  "에너지": ["Energetic", "Vivid"], "역동": ["Energetic", "Kinetic"], "로맨틱": ["Pastel", "Dreamlike", "Diffused"],
};

// The client's words that aren't in the fixed tag list. The AI checks each of these on every
// reference of the project (see askWords in lib/axia.js), so they can become spec points too.
export const WORDS_CATEGORY = "Client's words";
export const clientWords = (word = "") => wordsOf(word).filter((w) => !isFixedTag(w));

// Split the client's word field ("energetic, romantic") into words.
export const wordsOf = (word = "") => [...new Set(word.toLowerCase().split(/[,/&·+\s]+|\band\b/).map((w) => w.trim()).filter((w) => w && w !== "and"))];

// For each word: does the reference set show it? -> [{ word, verdict, ai?, share?, tags: [{ tag, share }], error? }]
// verdict: "shows" (in 30%+ of refs), "faint" (10–30%), "missing" (<10%),
//          "checking" (the AI hasn't answered yet), "unchecked" (the AI couldn't), "unknown" (no way to tell).
// A word that is a fixed tag is counted directly; any other word uses the AI's answers when there are
// any, else the list of words that usually show as certain tags.
const verdictOf = (share) => (share >= SHARE ? "shows" : share >= 0.1 ? "faint" : "missing");
export function checkWords(word, refs) {
  const n = refs.length || 1;
  return wordsOf(word).map((w) => {
    if (isFixedTag(w)) {
      const share = refs.filter((r) => r.tags.some((t) => t.toLowerCase() === w)).length / n;
      return { word: w, known: true, tags: [{ tag: cap(w), share }], share, verdict: verdictOf(share) };
    }
    if (refs.some((r) => r.words && w in r.words)) {
      const share = refs.filter((r) => r.words?.[w] === true).length / n;
      const checked = refs.filter((r) => r.words && w in r.words).length;
      const done = checked === refs.length || refs.some((r) => r.wordsError);
      return { word: w, known: true, ai: true, tags: [], share, checked, total: refs.length, verdict: done ? verdictOf(share) : "checking" };
    }
    // No AI answer yet: the tags that usually show this word, while the AI checks (or if it can't).
    const error = refs.find((r) => r.wordsError)?.wordsError;
    const checking = refs.length > 0 && !error;
    const key = Object.keys(WORD_HINTS).find((k) => w === k || w.startsWith(k) || k.startsWith(w));
    if (!key) return { word: w, known: false, tags: [], verdict: checking ? "checking" : error ? "unchecked" : "unknown", error };
    const tags = WORD_HINTS[key].map((tag) => ({ tag, share: refs.filter((r) => r.tags.includes(tag)).length / n }))
      .sort((a, b) => b.share - a.share);
    return { word: w, known: true, tags, verdict: verdictOf(tags[0]?.share ?? 0), checking };
  });
}

// One sentence that says what the look is, from the strongest kept points (one per category, up to 4).
// "matte surfaces, soft diffused light, toned-down colour and generous empty space"
const PHRASE = {
  Minimal: "few, essential elements", Whitespace: "generous empty space", Dense: "dense, busy layouts", Centered: "centred subjects",
  Grid: "a clear grid", Organic: "organic, flowing forms", Geometric: "geometric forms", Matte: "matte surfaces", Glossy: "glossy surfaces",
  Metallic: "metallic surfaces", Glass: "glass and transparency", Translucent: "translucent materials", Diffused: "soft, diffused light",
  Harsh: "hard light and crisp shadows", Studio: "clean studio light", Airy: "bright, airy tones", Shadowy: "deep shadows",
  Muted: "toned-down colour", Vivid: "vivid colour", Pastel: "pastel colour", Monochrome: "a single-colour palette",
  Grayscale: "black and white", Warm: "a warm palette", Cool: "a cool palette", Dark: "a dark palette", Sans: "sans-serif type",
  Serif: "serif type", Typographic: "type as the hero", Calm: "a calm mood", Energetic: "an energetic mood", Playful: "a playful mood",
  Luxurious: "a premium feel", Futuristic: "a futuristic feel", Dreamlike: "a dreamlike mood", Render: "3D renders", Product: "product focus",
};
export function summarise(items) {
  const seen = new Set(), parts = [];
  for (const it of [...items].filter((i) => !i.off && !i.custom && i.category !== "Palette").sort((a, b) => b.share - a.share)) {
    if (seen.has(it.category)) continue;
    seen.add(it.category);
    parts.push(PHRASE[it.tag] ?? it.tag.toLowerCase());
    if (parts.length === 4) break;
  }
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
