import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { type DocRow, findGuide, getDoc, listGuides, referenceFor, search, searchExamples } from "./db.js";
import { listInstalled, loadRegistry, lookupModels, readInstalled, searchInstalled, sourceMapFor } from "./local.js";

const MAX_CHARS = 20000;
const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError && { isError }) });
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n\n…(truncated, ${s.length - n} chars omitted)` : s);
export const docUrl = (path: string) =>
  path.startsWith("guides/")
    ? `https://github.com/mastra-ai/skills/tree/main/skills/${path.split("/")[1]}`
    : `https://mastra.ai/${path.replace(/\/index$/, "")}`;
const srcLine = (path: string) => (path.startsWith("guides/") ? docUrl(path) : `${docUrl(path)}.md`);
const render = (d: DocRow, n: number) => `# ${d.title}\nPath: ${d.path}\nSource: ${srcLine(d.path)}\n\n${clip(d.body, n)}`;

const INSTRUCTIONS = [
  "Mastra APIs change quickly; do not trust training data. Verify against docs before writing Mastra code.",
  "Priority: (1) installed_docs when node_modules/@mastra exists (matches the installed version), (2) search_docs / get_doc / get_api_reference / search_examples (latest published docs, may be ahead of the installed version).",
  "Models use the 'provider/model-name' format. Call lookup_model to verify a provider key and model name instead of guessing.",
  "Mastra requires ES2022 modules (not CommonJS).",
  "On type errors, 'Cannot find module' or constructor errors, suspect outdated knowledge first: call get_guide('common-errors'). For v0.x -> v1 upgrades use get_guide('migration-guide'). For project setup use get_guide('create-mastra'); for the `mastra api` CLI, traces and Trace Intelligence use get_guide('mastra-api'), 'trace-query', 'trace-intelligence'. Call get_guide with no topic to list guides.",
].join("\n");

export function createServer(db: DatabaseSync, ready: () => Promise<unknown>): McpServer {
  const server = new McpServer({ name: "mastra-mcp", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "search_docs",
    {
      description:
        "Search the latest Mastra documentation (agents, workflows, memory, tools, RAG, MCP, deployment, ...). Returns matching page paths; pass a path to get_doc.",
      inputSchema: {
        query: z.string().min(1).max(500).describe("Keywords, e.g. 'workflow suspend resume'"),
        kind: z.enum(["docs", "reference", "guide"]).optional().describe("docs, API reference, or skill guides (errors, migration, CLI)"),
        limit: z.number().int().min(1).max(20).default(5),
      },
    },
    async ({ query, kind, limit }) => {
      await ready();
      const hits = search(db, query, kind, limit);
      if (!hits.length) return text(`No results for "${query}".`);
      return text(
        hits.map((h, i) => `${i + 1}. ${h.title}\n   path: ${h.path} (${h.kind})\n   url: ${srcLine(h.path)}\n   ${h.description}\n   ${h.snippet}`).join("\n\n"),
      );
    },
  );

  server.registerTool(
    "search_examples",
    {
      description:
        "Search code examples (fenced code blocks) in the Mastra docs, e.g. 'workflow suspend resume', 'createTool zod'. Returns ready-to-adapt snippets with their source page. Verify against get_doc/installed_docs before relying on them.",
      inputSchema: {
        query: z.string().min(1).max(300),
        lang: z.enum(["ts", "tsx", "js", "bash", "json", "yaml"]).optional().describe("Restrict to a language"),
        limit: z.number().int().min(1).max(10).default(3),
        max_chars: z.number().int().min(200).max(4000).default(1500).describe("Max characters per snippet"),
      },
    },
    async ({ query, lang, limit, max_chars }) => {
      await ready();
      const hits = searchExamples(db, query, lang, limit);
      if (!hits.length) return text(`No code examples for "${query}". Try search_docs.`);
      return text(
        hits
          .map((h, i) => `${i + 1}. ${h.heading}\n   source: ${srcLine(h.path)}\n\n\`\`\`${h.lang}\n${clip(h.code, max_chars)}\n\`\`\``)
          .join("\n\n"),
      );
    },
  );

  server.registerTool(
    "get_doc",
    {
      description: "Get the full Markdown of a Mastra documentation page by path (from search_docs).",
      inputSchema: {
        path: z.string().min(1).max(300).describe("e.g. 'docs/agents/overview'"),
        max_chars: z.number().int().min(1000).max(MAX_CHARS).default(MAX_CHARS),
      },
    },
    async ({ path, max_chars }) => {
      await ready();
      const d = getDoc(db, path);
      return d ? text(render(d, max_chars)) : text(`Page not found: ${path}. Use search_docs to find a valid path.`, true);
    },
  );

  server.registerTool(
    "get_api_reference",
    {
      description: "Look up Mastra API reference (and integration) pages by class/function/method/backend name, e.g. 'Agent', 'createWorkflow', 'Memory', 'LibSQLStore'.",
      inputSchema: {
        symbol: z.string().min(1).max(100),
        max_chars: z.number().int().min(1000).max(MAX_CHARS).default(8000),
      },
    },
    async ({ symbol, max_chars }) => {
      await ready();
      let rows = referenceFor(db, symbol, 3);
      if (!rows.length) {
        rows = search(db, symbol, "reference", 3).flatMap((h) => getDoc(db, h.path) ?? []);
      }
      if (!rows.length) return text(`No API reference found for "${symbol}". Try search_docs with kind=reference.`, true);
      const per = Math.floor(max_chars / rows.length);
      return text(rows.map((r) => render(r, per)).join("\n\n---\n\n"));
    },
  );

  server.registerTool(
    "get_guide",
    {
      description:
        "Curated Mastra guides from the official mastra-ai/skills repo: common-errors, migration-guide, create-mastra, core-concepts, model-selection, mastra-api (CLI), trace-query, trace-intelligence, factory guides. No topic: list all guides.",
      inputSchema: {
        topic: z.string().max(100).optional().describe("e.g. 'common-errors' or 'guides/mastra/migration-guide'"),
        max_chars: z.number().int().min(1000).max(MAX_CHARS).default(MAX_CHARS),
      },
    },
    async ({ topic, max_chars }) => {
      await ready();
      if (!topic) {
        const gs = listGuides(db);
        return gs.length
          ? text(gs.map((g) => `${g.path}${g.description ? ` — ${g.description.slice(0, 140)}` : ""}`).join("\n"))
          : text("No guides indexed (the mastra-ai/skills fetch may have failed). Use search_docs.", true);
      }
      const g = findGuide(db, topic);
      return g ? text(render(g, max_chars)) : text(`Guide not found: ${topic}. Call get_guide with no topic to list guides.`, true);
    },
  );

  const projectDir = z.string().max(500).optional().describe("Project directory (default: server working directory)");

  server.registerTool(
    "installed_docs",
    {
      description:
        "Read documentation embedded in the installed @mastra/* packages (node_modules/@mastra/*/dist/docs), which matches the installed version exactly. Prefer this over search_docs when packages are installed. No arguments: list installed packages. With query: search. With package+file: read a page. With package+symbol: find the type-definition file.",
      inputSchema: {
        project_dir: projectDir,
        package: z.string().max(100).optional().describe("e.g. '@mastra/core'"),
        query: z.string().max(300).optional(),
        file: z.string().max(200).optional().describe("File name from a previous search, e.g. 'docs-agents-overview.md'"),
        symbol: z.string().max(100).optional().describe("Exported name, e.g. 'Agent'"),
        limit: z.number().int().min(1).max(20).default(8),
      },
    },
    async ({ project_dir, package: pkg, query, file, symbol, limit }) => {
      const dir = project_dir ?? process.cwd();
      const pkgs = listInstalled(dir);
      if (!pkgs.length) return text(`No node_modules/@mastra found from ${dir}. Install Mastra packages, or use search_docs for the latest published docs.`, true);
      if (pkg && file) {
        const body = readInstalled(dir, pkg, file, MAX_CHARS);
        return body ? text(body) : text(`Not found: ${pkg} ${file}`, true);
      }
      if (pkg && symbol) {
        const files = sourceMapFor(dir, pkg, symbol);
        return files.length ? text(`Type definitions for ${symbol}:\n${files.join("\n")}`) : text(`No SOURCE_MAP entry for ${symbol} in ${pkg}. Try query instead.`, true);
      }
      if (query) {
        const hits = searchInstalled(dir, query, pkg, limit);
        if (!hits.length) return text(`No embedded docs matched "${query}". Try search_docs.`);
        return text(hits.map((h, i) => `${i + 1}. ${h.pkg}@${h.version} ${h.file}\n   ${h.snippet}`).join("\n\n"));
      }
      return text(pkgs.map((p) => `${p.name}@${p.version} ${p.docsDir ? "(embedded docs)" : "(no embedded docs)"}`).join("\n"));
    },
  );

  server.registerTool(
    "lookup_model",
    {
      description:
        "Verify Mastra model-router providers and model names from the installed @mastra/core provider registry. No provider: list providers. Never guess model names; they change often.",
      inputSchema: {
        project_dir: projectDir,
        provider: z.string().max(100).optional().describe("e.g. 'openai', 'anthropic'"),
        query: z.string().max(100).optional().describe("Substring filter for model names"),
        limit: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ project_dir, provider, query, limit }) => {
      const reg = loadRegistry(project_dir ?? process.cwd());
      if (!reg) return text("provider-registry.json not found (install @mastra/core in the project, or check https://mastra.ai/models).", true);
      return text(lookupModels(reg, provider, query, limit));
    },
  );

  return server;
}
