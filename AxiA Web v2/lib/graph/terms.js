// What the map groups and filters by. Pure functions over library entries (see lib/axia.js).
import { hostOf } from "../links.js";

// Project types (axia-prototype's "field" codes) as shown on the map.
export const FIELD_NAMES = {
  "3d": "3D", graphic: "Graphic", photo: "Photo", architecture: "Architecture", typography: "Typography",
  painting: "Painting", package: "Package", video: "Video", ui_ux: "UI/UX", editorial: "Editorial", ai_image: "AI Image",
};
export const fieldNames = (e) => (e.fields.length ? e.fields.map((f) => FIELD_NAMES[f] ?? f) : [e.status === "tagged" ? "Other" : "Analysing"]);

// "kr.pinterest.com", "uk.pinterest.com" -> "pinterest.com" (country subdomains are one platform)
export const platformOf = (url) => hostOf(url).replace(/^[a-z]{2}\./, "");

// What the hubs are. An image links to every hub it belongs to, so one that is e.g. both
// Graphic and Package sits between those two.
export const GROUP_BY = {
  Color: (e) => (e.colors.length ? e.colors : ["No colour"]),
  Type: fieldNames,
  Tags: (e) => (e.tags.length ? e.tags : ["Untagged"]),
  Group: (e) => [e.group_name || "untagged"],
  Platform: (e) => [e.url ? platformOf(e.url) : "file"],
};

// Searchable terms of an image: its style tags plus its project types, group name and platform,
// so those can be searched and filtered like tags. KIND remembers which non-tag kind a term is.
export const KIND = new Map();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const termCache = new WeakMap();
export function termsOf(e) {
  if (termCache.has(e)) return termCache.get(e);
  const terms = [...e.tags];
  const add = (term, kind) => {
    if (!term || terms.includes(term)) return;
    terms.push(term);
    if (!KIND.has(term)) KIND.set(term, kind);
  };
  for (const f of e.fields) add(FIELD_NAMES[f] ?? f, "Type");
  add(e.group_name && cap(e.group_name), "Group");
  if (e.url) add(platformOf(e.url), "Platform");
  termCache.set(e, terms);
  return terms;
}

// Searched terms act as filters: an image shows only if it has every one of them.
export const passes = (e, selected) => selected.every((t) => termsOf(e).includes(t));

// [[term, count]] over the given entries, most used first, leaving out `exclude`.
export function countTerms(entries, exclude = []) {
  const count = {};
  for (const e of entries) for (const t of termsOf(e)) if (!exclude.includes(t)) count[t] = (count[t] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}

// Suggestions while typing: terms containing the text, those starting with it first, then by use.
export function suggest(terms, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return terms.slice(0, limit);
  return terms.filter(([t]) => t.toLowerCase().includes(q))
    .sort((a, b) => b[0].toLowerCase().startsWith(q) - a[0].toLowerCase().startsWith(q) || b[1] - a[1])
    .slice(0, limit);
}
