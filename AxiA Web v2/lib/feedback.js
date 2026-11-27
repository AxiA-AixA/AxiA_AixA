// Feedback from people testing AxiA: designers (the /feedback page) and clients (after answering a
// brief). Kept in data/feedback.json next to the projects (out of git). Server only.
import fs from "node:fs";
import path from "node:path";
import { newId } from "./projects.js";

const FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "data/feedback.json");

// The questions, in the order the summary and the Google Sheet use.
export const RATINGS = {
  designer: [
    ["easy", "Easy to use"],
    ["spec", "The spec matched my references"],
    ["use", "I'd use it with a real client"],
  ],
  client: [
    ["clear", "The brief was clear"],
    ["quick", "Answering was quick"],
  ],
};
export const TEXTS = {
  designer: [["worked", "What worked"], ["confusing", "What was confusing"], ["missing", "What's missing"]],
  client: [["comment", "Comment"]],
};
export const TRIED = ["Map", "Library", "Project & spec", "Sharing with a client", "Chrome extension"];

export function readFeedback() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

function write(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

const text = (v, n = 2000) => String(v ?? "").trim().slice(0, n);
const rating = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

// kind: "designer" | "client". Keeps only known fields. -> the saved entry
export function addFeedback(kind, body) {
  if (!RATINGS[kind]) throw new Error("unknown kind");
  const entry = { id: newId(), kind, at: new Date().toISOString(), name: text(body.name, 80) };
  for (const [k] of RATINGS[kind]) entry[k] = rating(body[k]);
  for (const [k] of TEXTS[kind]) entry[k] = text(body[k]);
  if (kind === "designer") {
    entry.role = text(body.role, 40);
    entry.tried = (Array.isArray(body.tried) ? body.tried : []).filter((t) => TRIED.includes(t));
  } else {
    entry.project = text(body.project, 120);
    entry.token = text(body.token, 40);
  }
  const list = readFeedback();
  list.push(entry);
  write(list);
  return entry;
}
