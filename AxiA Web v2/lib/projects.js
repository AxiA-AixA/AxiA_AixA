import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Projects live in data/projects.json (kept out of git: it holds client names and answers).
// Read-modify-write is synchronous, so concurrent requests can't interleave.
//
// Project: {
//   id, name, client, word,            // word = the client's own word for the look, e.g. "minimal"
//   refs: [libraryId],                 // references picked for this project
//   edits: { [tag]: { off, note } },   // designer's changes to the generated spec
//   custom: [{ key, text }],           // points the designer added by hand
//   shared: null | { token, at, items: [specItem] },  // the brief as the client sees it (a snapshot)
//   responses: [{ at, name, items: { [key]: { vote, comment } } }],
//   created, updated
// }
const root = /*turbopackIgnore: true*/ process.cwd();
const FILE = path.join(root, "data/projects.json");

export function readProjects() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
}

function write(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

export const newId = (bytes = 6) => crypto.randomBytes(bytes).toString("hex");
const now = () => new Date().toISOString();

export function createProject({ name, client = "", word = "" }) {
  const list = readProjects();
  const p = {
    id: newId(), name: String(name).slice(0, 120), client: String(client).slice(0, 120), word: String(word).slice(0, 60),
    refs: [], edits: {}, custom: [], shared: null, responses: [], created: now(), updated: now(),
  };
  list.unshift(p);
  write(list);
  return p;
}

export function getProject(id) {
  return readProjects().find((p) => p.id === id) ?? null;
}

// Designer edits. Only these fields can be changed from the page.
const EDITABLE = ["name", "client", "word", "refs", "edits", "custom"];
export function updateProject(id, patch) {
  const list = readProjects();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  for (const k of EDITABLE) if (k in patch) p[k] = patch[k];
  p.updated = now();
  write(list);
  return p;
}

export function deleteProject(id) {
  const list = readProjects();
  const next = list.filter((p) => p.id !== id);
  write(next);
  return next.length !== list.length;
}

// Freeze the current spec as the client's brief. Keeps the same link if one exists.
export function shareProject(id, items) {
  const list = readProjects();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  p.shared = { token: p.shared?.token ?? newId(12), at: now(), items };
  p.updated = now();
  write(list);
  return p;
}

export function findByToken(token) {
  return readProjects().find((p) => p.shared?.token === token) ?? null;
}

export function addResponse(token, { name, items }) {
  const list = readProjects();
  const p = list.find((x) => x.shared?.token === token);
  if (!p) return null;
  const keys = new Set(p.shared.items.map((i) => i.key));
  const clean = {};
  for (const [key, v] of Object.entries(items ?? {})) {
    if (!keys.has(key)) continue;
    const vote = ["agree", "unsure", "disagree"].includes(v?.vote) ? v.vote : null;
    const comment = String(v?.comment ?? "").slice(0, 1000);
    if (vote || comment) clean[key] = { vote, comment };
  }
  p.responses.push({ at: now(), name: String(name ?? "").slice(0, 80), items: clean });
  p.updated = now();
  write(list);
  return p;
}
