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
// custom: [{ key, text }] points the designer added by hand.
// Returns [{ key, tag, category, count, share, examples: [file], meaning, note, off, custom }].
export function buildSpec(refs, edits = {}, custom = []) {
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
  for (const it of items) {
    it.meaning = MEANING[it.tag] ?? "";
    it.note = edits[it.key]?.note ?? "";
    it.off = !!edits[it.key]?.off;
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
