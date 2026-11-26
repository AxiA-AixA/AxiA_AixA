// Where a project stands, as four steps: references → spec → client → agreed brief.
// Used by the project page (header) and the project list (cards). Pure.

export const ENOUGH = 5; // references before a spec means much
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The client's answers to the shared points: { agree, unsure, disagree, answered, total }.
export function tallyVotes(sharedKeys, votes) {
  const t = { agree: 0, unsure: 0, disagree: 0 };
  for (const k of sharedKeys) if (votes[k]?.vote) t[votes[k].vote]++;
  return { ...t, answered: t.agree + t.unsure + t.disagree, total: sharedKeys.size };
}

// Has the spec changed since it was shared (different points kept)?
export function changedSinceShare(shared, kept) {
  if (!shared) return false;
  const keys = new Set(shared.items.map((i) => i.key));
  return kept.length !== keys.size || kept.some((i) => !keys.has(i.key));
}

// The four steps for the project page.
// refs: references in the project; busy: being analysed; kept: spec points kept;
// shared: the shared snapshot or null; changed: changedSinceShare; tally: tallyVotes.
export function projectSteps({ refs, busy, kept, shared, changed, tally }) {
  const steps = [
    { key: "refs", label: "References", detail: `${refs}${busy ? ` · ${busy} analysing` : ""}`, done: refs >= ENOUGH && !busy },
    { key: "spec", label: "Spec", detail: plural(kept, "point"), done: kept >= 3 && !!shared && !changed },
    { key: "client", label: "Client", detail: shared ? `${tally.answered}/${tally.total} answered` : "not shared", done: !!shared && tally.answered === tally.total },
    { key: "agreed", label: "Agreed brief", detail: shared ? `${tally.agree}/${tally.total} agreed` : "after sharing", done: !!shared && tally.agree === tally.total },
  ];
  return { steps, current: steps.findIndex((s) => !s.done) };
}

// The one thing to do next on the project page: { action, text, disabled }.
// action is a name the page maps to a handler: addRefs, share, copy, agreed.
export function nextAction({ online, refs, busy, kept, shared, changed, tally }) {
  if (!online) return { text: "Start the AI analyser to continue", disabled: true };
  if (refs < ENOUGH) return { action: "addRefs", text: refs ? `Add ${plural(ENOUGH - refs, "more reference")}` : "Add references" };
  if (busy) return { text: `Analysing ${plural(busy, "reference")}…`, disabled: true };
  if (!shared) return { action: "share", text: "Share with client", disabled: !kept };
  if (changed) return { action: "share", text: "Update shared brief" };
  if (!tally.answered) return { action: "copy", text: "Copy client link" };
  return { action: "agreed", text: "Open agreed brief" };
}

// Step and next step in words for a project card, from a list summary
// ({ refs, shared, items, answered, agreed } as /api/projects gives it).
export function cardStage(p) {
  if (p.refs < ENOUGH) return { step: 0, next: p.refs ? `Add ${plural(ENOUGH - p.refs, "more reference")}` : "Add references" };
  if (!p.shared) return { step: 1, next: "Review the spec and share it" };
  if (p.answered < p.items) return { step: 2, next: p.answered ? `Client answered ${p.answered} of ${p.items}` : "Waiting for your client" };
  return { step: 3, next: p.agreed === p.items ? "Agreed brief ready" : `${plural(p.items - p.agreed, "point")} to discuss` };
}
