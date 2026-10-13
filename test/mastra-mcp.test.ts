import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { searchExamples, getDoc, referenceFor, openDb, search, toFtsQuery, translateJa } from "../src/db.js";
import { cleanMdx, ensureIndex, isStale, parseMdx, readGuides } from "../src/indexer.js";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareNewest, lookupModels, readInstalled, searchInstalled } from "../src/local.js";
import { createServer } from "../src/server.js";
import { runCommand, statusText } from "../src/cli.js";

const rows = [
  parseMdx("docs/agents/overview", '---\ntitle: "Agents"\ndescription: "Build agents"\n---\n# Agents\nUse the Agent class with tools.'),
  parseMdx("reference/agents/agent", '---\ntitle: "Reference: Agent"\npackages:\n  - "@mastra/core"\n---\n# Agent\nconstructor options'),
];

test("parseMdx extracts front matter and kind", () => {
  assert.equal(rows[0].title, "Agents");
  assert.equal(rows[0].kind, "docs");
  assert.equal(rows[1].kind, "reference");
  assert.equal(rows[1].packages, "@mastra/core");
});

test("toFtsQuery neutralises FTS syntax", () => {
  assert.equal(toFtsQuery('foo" OR NEAR('), '"foo" OR "NEAR"');
  assert.equal(toFtsQuery("how to use the agent", "AND"), '"agent"');
  assert.equal(toFtsQuery("***"), "");
});

test("ensureIndex builds once, then skips until stale; failure keeps old index", () => {
  const db = openDb(":memory:");
  assert.ok(isStale(db));
  assert.equal(ensureIndex(db, () => rows).refreshed, true);
  assert.equal(ensureIndex(db, () => assert.fail("should not refetch")).refreshed, false);
  assert.ok(isStale(db, Date.now() + 25 * 3600 * 1000));
  db.prepare("UPDATE meta SET value='0'").run();
  assert.match(ensureIndex(db, () => { throw new Error("offline"); }).error!, /offline/);
  assert.ok(search(db, "agent", undefined, 5).length > 0);
});

test("MCP tools end-to-end", async () => {
  const db = openDb(":memory:");
  ensureIndex(db, () => rows);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(db, async () => {}).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };

  const s = await call("search_docs", { query: "agent tools" });
  assert.match(s.content[0].text, /docs\/agents\/overview/);
  const d = await call("get_doc", { path: "docs/agents/overview" });
  assert.match(d.content[0].text, /Agent class/);
  assert.equal((await call("get_doc", { path: "nope" })).isError, true);
  assert.match((await call("get_api_reference", { symbol: "Agent" })).content[0].text, /constructor options/);
  assert.equal(getDoc(db, "reference/agents/agent.mdx")?.title, "Reference: Agent");
});

test("get_api_reference ranks exact symbol matches above migrations and mentions", () => {
  const db = openDb(":memory:");
  ensureIndex(db, () => [
    parseMdx("reference/migrations/upgrade-to-v1/workflows", "---\ntitle: Upgrade workflows\n---\n# Upgrade\ncreateWorkflow was renamed"),
    parseMdx("reference/workflows/create-workflow", '---\ntitle: "Reference: createWorkflow()"\n---\n# createWorkflow()\nBuilds a workflow.'),
    parseMdx("reference/file-based-agents/workflows", "---\ntitle: Workflows | File-based Agents\n---\n# Workflows\n```ts\nimport { createWorkflow } from '@mastra/core/workflows';\n```"),
    parseMdx("reference/workflows/run", "---\ntitle: Run\n---\n# Run\n## Run.createRun()\n"),
  ]);
  const paths = (s: string) => referenceFor(db, s, 3).map((r) => r.path);
  assert.equal(paths("createWorkflow")[0], "reference/workflows/create-workflow");
  assert.deepEqual(paths("createWorkflow"), ["reference/workflows/create-workflow"]);
  assert.equal(paths("create-workflow")[0], "reference/workflows/create-workflow");
  assert.equal(paths("createRun")[0], "reference/workflows/run");
  assert.deepEqual(paths("nonexistentSymbol"), []);
});

test("get_api_reference resolves backend-style names via stems and constructor usage", () => {
  const db = openDb(":memory:");
  ensureIndex(db, () => [
    parseMdx("integrations/databases/libsql", "---\ntitle: libSQL | Database\n---\n# libSQL\nnew LibSQLStore({ url })"),
    parseMdx("reference/vectors/libsql", "---\ntitle: \"Reference: libSQL vector store | Vectors\"\n---\n# libSQL"),
    parseMdx("docs/memory/overview", "---\ntitle: Memory\n---\n# Memory\nnew LibSQLStore({ url })"),
    parseMdx("reference/memory/memory-class", "---\ntitle: Memory class\n---\n# Memory"),
  ]);
  const paths = referenceFor(db, "LibSQLStore", 3).map((r) => r.path);
  assert.deepEqual(paths.slice(0, 2).sort(), ["integrations/databases/libsql", "reference/vectors/libsql"]);
  assert.equal(referenceFor(db, "Memory", 1)[0].path, "reference/memory/memory-class");
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "mm-proj-"));
  const core = join(dir, "node_modules", "@mastra", "core");
  mkdirSync(join(core, "dist", "docs", "references"), { recursive: true });
  mkdirSync(join(core, "dist", "docs", "assets"), { recursive: true });
  writeFileSync(join(core, "package.json"), '{"version":"1.2.3"}');
  writeFileSync(join(core, "dist", "docs", "references", "docs-agents-overview.md"), "# Agents\nCreate an Agent with instructions.");
  writeFileSync(join(core, "dist", "docs", "assets", "SOURCE_MAP.json"), '{"exports":{"Agent":{"types":"dist/agent/agent.d.ts"}}}');
  writeFileSync(
    join(core, "dist", "provider-registry.json"),
    JSON.stringify({ providers: { openai: { name: "OpenAI", apiKeyEnvVar: "OPENAI_API_KEY", models: ["gpt-4o", "gpt-5.4", "gpt-5.6-sol", "o3"] } } }),
  );
  return dir;
}

test("installed docs: search, read, traversal guard, walk-up", () => {
  const dir = fixture();
  const sub = join(dir, "src", "deep");
  mkdirSync(sub, { recursive: true });
  const hits = searchInstalled(sub, "agent instructions", undefined, 5);
  assert.equal(hits[0].file, "docs-agents-overview.md");
  assert.equal(hits[0].version, "1.2.3");
  assert.match(readInstalled(dir, "@mastra/core", "docs-agents-overview.md", 1000)!, /Create an Agent/);
  assert.equal(readInstalled(dir, "@mastra/core", "../../package.json", 1000), null);
  assert.equal(searchInstalled(tmpdir(), "agent", undefined, 5).length, 0);
});

test("lookup_model sorts newest first and validates provider", () => {
  const reg = JSON.parse('{"providers":{"openai":{"name":"OpenAI","models":["gpt-4o","gpt-5.4","gpt-5.6-sol","o3"]}}}');
  assert.equal(["gpt-4o", "gpt-5.4", "gpt-5.6-sol"].sort(compareNewest)[0], "gpt-5.6-sol");
  assert.match(lookupModels(reg, "openai", "gpt-5", 10), /openai\/gpt-5\.6-sol\nopenai\/gpt-5\.4/);
  assert.match(lookupModels(reg, "opena", undefined, 5), /Did you mean|Unknown/);
});

test("MCP: installed_docs, lookup_model, instructions, source urls", async () => {
  const dir = fixture();
  const db = openDb(":memory:");
  ensureIndex(db, () => rows);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(db, async () => {}).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  assert.match(client.getInstructions() ?? "", /installed_docs/);
  const call = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  assert.match((await call("installed_docs", { project_dir: dir })).content[0].text, /@mastra\/core@1\.2\.3 \(embedded docs\)/);
  assert.match((await call("installed_docs", { project_dir: dir, query: "agent" })).content[0].text, /docs-agents-overview/);
  assert.match((await call("installed_docs", { project_dir: dir, package: "@mastra/core", symbol: "Agent" })).content[0].text, /agent\.d\.ts/);
  assert.equal((await call("installed_docs", { project_dir: tmpdir() })).isError, true);
  assert.match((await call("lookup_model", { project_dir: dir, provider: "openai" })).content[0].text, /openai\/gpt-5\.6-sol/);
  assert.match((await call("search_docs", { query: "agent" })).content[0].text, /https:\/\/mastra\.ai\/docs\/agents\/overview\.md/);
});

test("guides: readGuides maps skill files, get_guide resolves short topics, references exclude guides", async () => {
  const root = mkdtempSync(join(tmpdir(), "mm-skills-"));
  mkdirSync(join(root, "mastra", "references"), { recursive: true });
  writeFileSync(join(root, "mastra", "SKILL.md"), "---\nname: mastra\ndescription: Mastra guide\n---\n# Mastra Framework Guide\nAgent");
  writeFileSync(join(root, "mastra", "references", "common-errors.md"), "# Common Errors\nCannot find module Agent");
  writeFileSync(join(root, "mastra", "references", "notes.txt"), "ignored");
  const guides = readGuides(root);
  assert.deepEqual(guides.map((g) => g.path).sort(), ["guides/mastra", "guides/mastra/common-errors"]);
  assert.equal(guides[0].kind, "guide");

  const db = openDb(":memory:");
  ensureIndex(db, () => [...rows, ...guides]);
  assert.deepEqual(referenceFor(db, "Agent", 5).map((r) => r.kind).filter((k) => k === "guide"), []);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(db, async () => {}).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  const call = async (args: Record<string, unknown>) =>
    (await client.callTool({ name: "get_guide", arguments: args })) as { content: { text: string }[]; isError?: boolean };
  assert.match((await call({})).content[0].text, /guides\/mastra\/common-errors/);
  assert.match((await call({ topic: "common-errors" })).content[0].text, /Cannot find module/);
  assert.equal((await call({ topic: "nope" })).isError, true);
  const found = (await client.callTool({ name: "search_docs", arguments: { query: "cannot find module", kind: "guide" } })) as { content: { text: string }[] };
  assert.match(found.content[0].text, /guides\/mastra\/common-errors/);
});

test("cleanMdx strips imports and Tabs outside fences only", () => {
  const out = cleanMdx(
    'import Tabs from "@theme/Tabs";\n\n<Tabs>\n<TabItem value="z" label="Zod">\n```ts\nimport { z } from "zod";\n<Tabs>\n```\n</TabItem>\n</Tabs>\nText',
  );
  assert.ok(!out.includes('@theme/Tabs'));
  assert.ok(out.includes("**Zod**") && out.includes('import { z } from "zod";') && out.includes("<Tabs>\n```"));
  assert.ok(!out.includes("</TabItem>"));
});

test("search is AND-first and reference lookups drop weak tail results", () => {
  const db = openDb(":memory:");
  ensureIndex(db, () => [
    parseMdx("docs/a", "---\ntitle: A\n---\nstructured output with tools"),
    parseMdx("docs/b", "---\ntitle: B\n---\nproject structure only"),
    parseMdx("reference/tools/create-tool", "---\ntitle: createTool()\n---\n# createTool()"),
    parseMdx("reference/workflows/workflow-methods/tool", "---\ntitle: Workflow.tool()\n---\n# Workflow.tool()\ncreateTool is mentioned"),
    parseMdx("reference/configuration", "---\ntitle: Configuration\n---\ncreateTool createTool"),
  ]);
  assert.equal(search(db, "structured output tools", undefined, 5)[0].path, "docs/a");
  assert.deepEqual(referenceFor(db, "createTool", 3).map((r) => r.path), ["reference/tools/create-tool"]);
});

test("legacy pages are demoted unless requested", () => {
  const db = openDb(":memory:");
  ensureIndex(db, () => [
    parseMdx("reference/agents/generateLegacy", "---\ntitle: Agent.generateLegacy() (Legacy)\n---\ngenerate generate generate output"),
    parseMdx("reference/agents/generate", "---\ntitle: Agent.generate()\n---\ngenerate output"),
  ]);
  assert.equal(search(db, "generate output", undefined, 5)[0].path, "reference/agents/generate");
  assert.equal(search(db, "legacy generate output", undefined, 5)[0].path, "reference/agents/generateLegacy");
});

test("examples: extraction, search, language filter, per-page cap", async () => {
  const md = (t: string) =>
    `---\ntitle: ${t}\n---\n# ${t}\n## Create a tool\n\`\`\`typescript title="src/tool.ts"\nimport { createTool } from '@mastra/core/tools'\nexport const t = createTool({ id: 'x' })\n\`\`\`\n\`\`\`bash\nnpm install @mastra/core --save-exact-version\n\`\`\`\n\`\`\`ts\nshort\n\`\`\`\n`;
  const db = openDb(":memory:");
  ensureIndex(db, () => [parseMdx("docs/tools/overview", md("Tools")), parseMdx("docs/other", md("Other"))]);
  const hits = searchExamples(db, "createTool", undefined, 5);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].lang, "ts");
  assert.match(hits[0].heading, /src\/tool\.ts/);
  assert.equal(searchExamples(db, "install mastra", "bash", 5).length, 2);
  assert.equal(searchExamples(db, "short", undefined, 5).length, 0);

  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(db, async () => {}).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  const r = (await client.callTool({ name: "search_examples", arguments: { query: "createTool", lang: "ts" } })) as { content: { text: string }[] };
  assert.match(r.content[0].text, /```ts\nimport \{ createTool \}/);
  assert.match(r.content[0].text, /source: https:\/\/mastra\.ai\/docs\/tools\/overview\.md/);
});

test("ensureIndex force refreshes a fresh index", () => {
  const db = openDb(":memory:");
  ensureIndex(db, () => rows);
  let calls = 0;
  const fetcher = () => {
    calls++;
    return rows;
  };
  assert.equal(ensureIndex(db, fetcher).refreshed, false);
  assert.equal(ensureIndex(db, fetcher, true).refreshed, true);
  assert.equal(calls, 1);
});

test("CLI: statusText and unknown command exit code", () => {
  const dir = mkdtempSync(join(tmpdir(), "mm-cli-"));
  const file = join(dir, "i.db");
  assert.match(statusText(file), /documents: 0\nindexed: never/);
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(runCommand("bogus", file), 2);
  } finally {
    console.error = err;
  }
});

test("translateJa: maps known terms, prefers longer terms, drops unknown Japanese", () => {
  const t = (q: string) => translateJa(q).split(/\s+/).filter(Boolean).join(" ");
  assert.equal(t("ワーキングメモリの使い方"), "working memory");
  assert.equal(t("ツール呼び出しを実装"), "tool calling");
  assert.equal(t("エージェントネットワークを構築"), "agent network");
  assert.equal(t("RAGのチャンク分割"), "RAG chunking");
  assert.equal(t("createWorkflow"), "createWorkflow");
  assert.equal(t("あいう"), "あいう");
});

test("translateJa: covers docs topics", () => {
  const t = (q: string) => translateJa(q).split(/\s+/).filter(Boolean).join(" ");
  assert.equal(t("サンドボックスのファイルシステム"), "sandbox filesystem");
  assert.equal(t("マルチエージェントの委譲"), "multi-agent delegation");
  assert.equal(t("ゲートウェイとプロバイダー"), "gateway provider");
  assert.equal(t("エラー処理とタイムアウト"), "error handling timeout");
});

test("translateJa: reference areas and generic verbs", () => {
  const t = (q: string) => translateJa(q).split(/\s+/).filter(Boolean).join(" ");
  assert.equal(t("ワーカーのライフサイクルフック"), "workers lifecycle hooks");
  assert.equal(t("ベクターストアのメタデータを取得"), "vector store metadata");
  assert.equal(t("ツール呼び出しの最大ステップ"), "tool calling max steps");
  assert.equal(t("レート制限"), "rate limit");
});
