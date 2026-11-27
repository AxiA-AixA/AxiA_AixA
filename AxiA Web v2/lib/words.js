// Server side: after a project's words or references change, ask the AI to check the client's
// words that aren't fixed tags on every reference (answers show up in the library as entry.words).
import { askWords } from "./axia.js";
import { clientWords } from "./spec.js";

export function checkProjectWords(p) {
  const words = clientWords(p?.word);
  if (!p || !words.length || !p.refs.length) return;
  askWords(p.refs, words).catch(() => {}); // the analyser may be off; the page shows "checking" until it answers
}
