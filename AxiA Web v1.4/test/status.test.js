import { test } from "node:test";
import assert from "node:assert/strict";
import { cardStage, changedSinceShare, nextAction, projectSteps, tallyVotes, ENOUGH } from "../lib/status.js";

const tally0 = { agree: 0, unsure: 0, disagree: 0, answered: 0, total: 3 };
const base = { online: true, refs: ENOUGH, busy: 0, kept: 3, shared: null, changed: false, tally: tally0 };

test("next action walks through the four steps", () => {
  assert.equal(nextAction({ ...base, online: false }).disabled, true);
  assert.equal(nextAction({ ...base, refs: 2 }).text, "Add 3 more references");
  assert.equal(nextAction({ ...base, refs: 4 }).text, "Add 1 more reference");
  assert.equal(nextAction({ ...base, busy: 1 }).disabled, true);
  assert.equal(nextAction(base).action, "share");
  assert.equal(nextAction({ ...base, kept: 0 }).disabled, true);
  const shared = { items: [] };
  assert.equal(nextAction({ ...base, shared, changed: true }).text, "Update shared brief");
  assert.equal(nextAction({ ...base, shared }).action, "copy");
  assert.equal(nextAction({ ...base, shared, tally: { ...tally0, answered: 1, agree: 1 } }).action, "agreed");
});

test("steps: the first one not done is current", () => {
  const { current } = projectSteps({ ...base, refs: 1 });
  assert.equal(current, 0);
  assert.equal(projectSteps(base).current, 1);
});

test("tally counts only shared points", () => {
  const t = tallyVotes(new Set(["a", "b"]), { a: { vote: "agree" }, c: { vote: "disagree" } });
  assert.deepEqual(t, { agree: 1, unsure: 0, disagree: 0, answered: 1, total: 2 });
});

test("changed since share compares the kept points", () => {
  const shared = { items: [{ key: "a" }, { key: "b" }] };
  assert.equal(changedSinceShare(shared, [{ key: "a" }, { key: "b" }]), false);
  assert.equal(changedSinceShare(shared, [{ key: "a" }]), true);
  assert.equal(changedSinceShare(null, []), false);
});

test("project cards say the next step", () => {
  assert.equal(cardStage({ refs: 0 }).next, "Add references");
  assert.equal(cardStage({ refs: 6, shared: false }).step, 1);
  assert.equal(cardStage({ refs: 6, shared: true, items: 4, answered: 4, agreed: 4 }).next, "Agreed brief ready");
});
