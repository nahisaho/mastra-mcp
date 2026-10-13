import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { type DocRow, indexedAt, replaceAll } from "./db.js";

const REPO = "https://github.com/mastra-ai/mastra";
const SKILLS_REPO = "https://github.com/mastra-ai/skills";
const CONTENT = "docs/src/content/en";
export const TTL_MS = 24 * 60 * 60 * 1000;

export function parseMdx(path: string, raw: string): DocRow {
  let body = raw;
  let front = "";
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    front = m[1];
    body = raw.slice(m[0].length);
  }
  const title = scalar(front, "title") || body.match(/^#\s+(.+)$/m)?.[1] || path;
  const description = scalar(front, "description");
  const packages = [...front.matchAll(/^\s+-\s+["']?([^"'\n]+)["']?\s*$/gm)].map((x) => x[1]).join(" ");
  const kind = path.startsWith("reference/") ? "reference" : path.startsWith("guides/") ? "guide" : "docs";
  const { headings, imports } = extractSymbols(title, body);
  return { path, kind, title, description, packages, body: cleanMdx(body).trim(), headings, imports };
}

// Drops MDX-only noise outside code fences: component imports and Tabs wrappers (TabItem labels become bold text).
export function cleanMdx(body: string): string {
  let fence = "";
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const f = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (f) fence = !fence ? f[0] : f[0] === fence[0] ? "" : fence;
    if (!fence && !f) {
      if (/^import\s.+\sfrom\s+["'][^"']+["'];?\s*$/.test(line)) continue;
      if (/^\s*<\/?(Tabs|TabItem)\b[^>]*>\s*$/.test(line)) {
        const label = line.match(/<TabItem\b[^>]*\blabel=["']([^"']+)["']/)?.[1];
        if (label) out.push(`**${label}**`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

const pad = (xs: Set<string>) => (xs.size ? ` ${[...xs].join(" ")} ` : "");

// Lower-cased, space-padded identifier lists so exact symbol lookups can use LIKE '% name %'.
export function extractSymbols(title: string, body: string): { headings: string; imports: string } {
  const headings = new Set<string>();
  const addIds = (text: string, into: Set<string>) => {
    for (const m of text.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g)) {
      into.add(m[0].toLowerCase());
      into.add((m[0].split(".").pop() as string).toLowerCase());
    }
  };
  addIds(title, headings);
  for (const m of body.matchAll(/^#{1,4}\s+(.+)$/gm)) addIds(m[1], headings);
  const imports = new Set<string>();
  for (const m of body.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@mastra\//g)) {
    for (const name of m[1].split(",")) {
      const id = name.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "");
      if (id) imports.add(id.toLowerCase());
    }
  }
  for (const m of body.matchAll(/\bnew\s+([A-Z][\w$]*)\s*\(|\bclass\s+([A-Z][\w$]*)/g)) imports.add((m[1] ?? m[2]).toLowerCase());
  return { headings: pad(headings), imports: pad(imports) };
}

function scalar(front: string, key: string): string {
  const m = front.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.mdx?$/.test(name)) out.push(p);
  }
  return out;
}

export function readDocs(contentDir: string): DocRow[] {
  return walk(contentDir).map((f) => {
    const rel = relative(contentDir, f).split("\\").join("/").replace(/\.mdx?$/, "");
    return parseMdx(rel, readFileSync(f, "utf8"));
  });
}

function sparseClone(repo: string, subdir: string): { dir: string; cleanup: () => void } {
  const tmp = mkdtempSync(join(tmpdir(), "mastra-docs-"));
  const run = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, stdio: "pipe" });
  try {
    run(tmp, "clone", "--depth", "1", "--filter=blob:none", "--sparse", repo, "repo");
    const cwd = join(tmp, "repo");
    run(cwd, "sparse-checkout", "set", subdir);
    return { dir: join(cwd, subdir), cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

// Skill guides: skills/<skill>/SKILL.md -> guides/<skill>, skills/<skill>/references/<name>.md -> guides/<skill>/<name>.
export function readGuides(skillsDir: string): DocRow[] {
  const rows: DocRow[] = [];
  for (const f of walk(skillsDir)) {
    const rel = relative(skillsDir, f).split("\\").join("/");
    const m = rel.match(/^([^/]+)\/(?:SKILL\.md|references\/(.+)\.md)$/);
    if (!m) continue;
    rows.push(parseMdx(m[2] ? `guides/${m[1]}/${m[2]}` : `guides/${m[1]}`, readFileSync(f, "utf8")));
  }
  return rows;
}

export function fetchDocs(): DocRow[] {
  const docs = sparseClone(REPO, CONTENT);
  let rows: DocRow[];
  try {
    rows = readDocs(docs.dir);
  } finally {
    docs.cleanup();
  }
  // Guides are optional: a failure here must not lose the docs.
  try {
    const skills = sparseClone(SKILLS_REPO, "skills");
    try {
      rows.push(...readGuides(skills.dir));
    } finally {
      skills.cleanup();
    }
  } catch {}
  return rows;
}

export function isStale(db: DatabaseSync, now = Date.now()): boolean {
  const at = indexedAt(db);
  return at === null || now - at > TTL_MS;
}

// Refreshes the index when missing or older than 24h. A failed refresh keeps the old index.
export function ensureIndex(db: DatabaseSync, fetcher: () => DocRow[] = fetchDocs, force = false): { refreshed: boolean; error?: string } {
  if (!force && !isStale(db)) return { refreshed: false };
  try {
    const rows = fetcher();
    if (rows.length === 0) throw new Error("no documents found");
    replaceAll(db, rows);
    return { refreshed: true };
  } catch (e) {
    return { refreshed: false, error: e instanceof Error ? e.message : String(e) };
  }
}
