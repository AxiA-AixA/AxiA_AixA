import assert from "node:assert";
import { parseCsv } from "../csv.js";
const rows = parseCsv('tag,definition,example\r\nwarm,"노랑, 주황 쪽 ""따뜻한""",3d/001.jpg\n\nmatte,"line1\nline2",\n');
assert.deepEqual(rows, [
  { tag: "warm", definition: '노랑, 주황 쪽 "따뜻한"', example: "3d/001.jpg" },
  { tag: "matte", definition: "line1\nline2", example: "" },
]);
assert.deepEqual(parseCsv("file,tags,source,split\n"), []);
console.log("csv ok");
