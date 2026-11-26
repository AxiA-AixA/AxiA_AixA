import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpec, checkWords, latestVotes, summarise, CLEAR } from "../lib/spec.js";

const ref = (file, tags, colors = []) => ({ file, tags, colors });
const refs = [
  ref("a", ["Minimal", "Matte", "Calm"], ["White"]),
  ref("b", ["Minimal", "Matte", "Diffused"], ["White"]),
  ref("c", ["Minimal", "Glossy", "Calm"], ["Black"]),
  ref("d", ["Minimal", "Matte"], ["White"]),
  ref("e", ["Dense", "Vivid"], ["Red"]),
];

test("a tag shared by most references becomes a point; one-offs don't", () => {
  const spec = buildSpec(refs);
  const tags = spec.map((i) => i.tag);
  assert.ok(tags.includes("Minimal"));
  assert.ok(tags.includes("Matte"));
  assert.ok(!tags.includes("Dense"), "in 1 of 5 references only");
  const minimal = spec.find((i) => i.tag === "Minimal");
  assert.equal(minimal.count, 4);
  assert.equal(minimal.share, 0.8);
});

test("weaker points start switched off; the designer's choice wins", () => {
  const calm = buildSpec(refs).find((i) => i.tag === "Calm"); // 2 of 5 = 40%
  assert.ok(calm.share < CLEAR);
  assert.equal(calm.off, true);
  assert.equal(buildSpec(refs, { Calm: { off: false } }).find((i) => i.tag === "Calm").off, false);
  assert.equal(buildSpec(refs, { Minimal: { off: true } }).find((i) => i.tag === "Minimal").off, true);
});

test("designer's own points are added, kept on", () => {
  const spec = buildSpec(refs, {}, [{ key: "custom-1", text: "No neon" }]);
  const mine = spec.find((i) => i.key === "custom-1");
  assert.equal(mine.custom, true);
  assert.equal(mine.off, false);
});

test("the client's word is checked against the references", () => {
  const [w] = checkWords("minimal", refs);
  assert.equal(w.verdict, "shows");
  assert.equal(checkWords("futuristic", refs)[0].verdict, "missing");
  assert.equal(checkWords("zzz", refs)[0].verdict, "unknown");
});

test("latest answer per point wins", () => {
  const votes = latestVotes([
    { name: "A", at: "1", items: { Minimal: { vote: "unsure" } } },
    { name: "A", at: "2", items: { Minimal: { vote: "agree" } } },
  ]);
  assert.equal(votes.Minimal.vote, "agree");
});

test("summary names the strongest kept points", () => {
  assert.match(summarise(buildSpec(refs)), /few, essential elements/);
});
