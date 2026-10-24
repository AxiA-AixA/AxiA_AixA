import assert from "node:assert";
import { extractLinks, hostOf } from "../links.js";
import { parseOg } from "../og.js";

const ig = JSON.stringify({ saved_saved_media: [
  { string_map_data: { "Saved on": { href: "https://www.instagram.com/p/ABC/", timestamp: 1 } } },
  { string_map_data: { "Saved on": { href: "https://www.instagram.com/p/ABC/" } } },
]}).replace(/\//g, "\\/");
assert.deepEqual(extractLinks(ig), ["https://www.instagram.com/p/ABC/"]);
assert.deepEqual(extractLinks("see https://a.com/x, and (https://b.com/y)."), ["https://a.com/x", "https://b.com/y"]);
assert.equal(hostOf("https://www.pinterest.com/pin/1"), "pinterest.com");

const og = parseOg('<title>T</title><meta content="/img.jpg?a=1&amp;b=2" property="og:image">', "https://s.com/p/1");
assert.deepEqual(og, { image: "https://s.com/img.jpg?a=1&b=2", title: "T" });
assert.deepEqual(parseOg("<html></html>", "https://s.com"), { image: null, title: null });
console.log("links/og ok");
assert.equal(parseOg(`<meta property="og:title" content="Jo's work">`, "https://s.com").title, "Jo's work");
console.log("apostrophe ok");
assert.deepEqual(extractLinks(JSON.stringify({ media: [
  { uri: "https://scontent-lhr6-1.cdninstagram.com/v/t51/123.jpg?stp=x&oh=y" },
  { uri: "https://video.fbcdn.net/v/abc.mp4" },
  { href: "https://www.instagram.com/p/XYZ/" },
]})), ["https://www.instagram.com/p/XYZ/"]);
console.log("cdn filter ok");
assert.equal(parseOg('<meta property="og:title" content="Instagram (&#064;instagram) &#x2022; A &amp; B">', "https://s.com").title, "Instagram (@instagram) • A & B");
console.log("entities ok");
