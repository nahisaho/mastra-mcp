import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { openDb, referenceFor, search, searchExamples, translateJa } from "../src/db.js";
import { ensureIndex, parseMdx } from "../src/indexer.js";

// Golden ranking checks over real Mastra doc pages (test/fixtures/docs-subset.json).
// Regenerate the fixture with scripts/make-fixture.mjs after intentionally changing ranking.
interface Golden {
  tool: "api" | "search" | "examples" | "guide";
  query: string;
  lang?: string;
  first?: string;
  includes?: string[];
  excludes?: string[];
  top?: number;
}

const read = (name: string) => readFileSync(new URL(`../../test/${name}`, import.meta.url), "utf8");
const golden = JSON.parse(read("golden.json")) as Golden[];
const pages = JSON.parse(read("fixtures/docs-subset.json")) as { path: string; raw: string }[];

const db = openDb(":memory:");
ensureIndex(db, () => pages.map((p) => parseMdx(p.path, p.raw)));

function run(g: Golden): string[] {
  switch (g.tool) {
    case "api":
      return referenceFor(db, translateJa(g.query), 3).map((r) => r.path);
    case "search":
      return search(db, g.query, undefined, 5).map((h) => h.path);
    case "guide":
      return search(db, g.query, "guide", 5).map((h) => h.path);
    case "examples":
      return searchExamples(db, g.query, g.lang, 5).map((h) => h.path);
  }
}

for (const g of golden) {
  test(`golden ${g.tool}: ${g.query}`, () => {
    const paths = run(g);
    const top = paths.slice(0, g.top ?? paths.length);
    const ctx = `got: ${JSON.stringify(paths)}`;
    if (g.first) assert.equal(paths[0], g.first, ctx);
    for (const p of g.includes ?? []) assert.ok(top.includes(p), `${p} missing in top ${g.top ?? "all"}; ${ctx}`);
    for (const p of g.excludes ?? []) assert.ok(!top.includes(p), `${p} should not be in top ${g.top ?? "all"}; ${ctx}`);
  });
}
