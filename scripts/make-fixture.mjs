// Regenerates test/fixtures/docs-subset.json from a live index (run `mastra-mcp refresh` first).
// Usage: MASTRA_MCP_DB=/tmp/golden.db node scripts/make-fixture.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { openDb, search, searchExamples, referenceFor, docCount } from "../dist/db.js";

const MAX_BODY = 3000;
const db = openDb(process.env.MASTRA_MCP_DB ?? "/tmp/golden.db");
if (docCount(db) === 0) throw new Error("index is empty; run `mastra-mcp refresh` with the same MASTRA_MCP_DB");
const golden = JSON.parse(readFileSync(new URL("../test/golden.json", import.meta.url), "utf8"));

const keep = new Set();
for (const g of golden) {
  for (const p of [g.first, ...(g.includes ?? []), ...(g.excludes ?? [])]) if (p) keep.add(p);
  const n = 8;
  if (g.tool === "api") referenceFor(db, g.query, n).forEach((r) => keep.add(r.path));
  if (g.tool === "search") search(db, g.query, undefined, n).forEach((h) => keep.add(h.path));
  if (g.tool === "guide") search(db, g.query, "guide", n).forEach((h) => keep.add(h.path));
  if (g.tool === "examples") searchExamples(db, g.query, g.lang, n).forEach((h) => keep.add(h.path));
}

const all = db.prepare("SELECT * FROM docs ORDER BY path").all();
// Deterministic sample of unrelated pages so the subset still contains distractors.
all.forEach((d, i) => i % 15 === 0 && keep.add(d.path));

const q = (v) => JSON.stringify(String(v ?? ""));
const pages = all
  .filter((d) => keep.has(d.path))
  .map((d) => {
    const pk = d.packages ? "packages:\n" + d.packages.split(" ").map((x) => "  - " + q(x)).join("\n") + "\n" : "";
    return { path: d.path, raw: "---\ntitle: " + q(d.title) + "\ndescription: " + q(d.description) + "\n" + pk + "---\n" + d.body.slice(0, MAX_BODY) };
  });

mkdirSync(new URL("../test/fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("../test/fixtures/docs-subset.json", import.meta.url), JSON.stringify(pages));
console.log("wrote " + pages.length + " pages");
