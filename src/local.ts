import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export interface InstalledPkg {
  name: string;
  version: string;
  docsDir: string | null;
}

// Walk up from dir to the nearest node_modules/@mastra (the project the agent is working in).
export function findMastraModules(dir: string): string | null {
  let cur = resolve(dir);
  for (let i = 0; i < 12; i++) {
    const m = join(cur, "node_modules", "@mastra");
    if (existsSync(m)) return m;
    const up = dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return null;
}

export function listInstalled(dir: string): InstalledPkg[] {
  const root = findMastraModules(dir);
  if (!root) return [];
  return readdirSync(root)
    .filter((n) => existsSync(join(root, n, "package.json")))
    .sort()
    .map((n) => {
      const pkgDir = join(root, n);
      let version = "unknown";
      try {
        version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version ?? version;
      } catch {}
      const docs = join(pkgDir, "dist", "docs");
      return { name: `@mastra/${n}`, version, docsDir: existsSync(join(docs, "references")) ? docs : null };
    });
}

export interface LocalHit {
  pkg: string;
  version: string;
  file: string;
  snippet: string;
  score: number;
}

const terms = (q: string) => (q.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter((t) => t.length > 1);

export function searchInstalled(dir: string, query: string, pkg: string | undefined, limit: number): LocalHit[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const hits: LocalHit[] = [];
  for (const p of listInstalled(dir)) {
    if (!p.docsDir || (pkg && p.name !== pkg)) continue;
    const refs = join(p.docsDir, "references");
    for (const f of readdirSync(refs).filter((x) => x.endsWith(".md"))) {
      const body = readFileSync(join(refs, f), "utf8");
      const lower = body.toLowerCase();
      const name = f.toLowerCase();
      let score = 0;
      for (const t of ts) {
        if (name.includes(t)) score += 10;
        const idx = lower.indexOf(t);
        if (idx >= 0) score += 2 + Math.min(5, lower.split(t).length - 1);
      }
      if (score < 4) continue;
      const at = Math.max(0, lower.indexOf(ts.find((t) => lower.includes(t)) as string));
      hits.push({ pkg: p.name, version: p.version, file: f, snippet: body.slice(at, at + 160).replace(/\s+/g, " "), score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function readInstalled(dir: string, pkg: string, file: string, maxChars: number): string | null {
  const p = listInstalled(dir).find((x) => x.name === pkg);
  if (!p?.docsDir) return null;
  const refs = resolve(p.docsDir, "references");
  const target = resolve(refs, file);
  if (!target.startsWith(refs + sep) || !existsSync(target) || !statSync(target).isFile()) return null;
  const body = readFileSync(target, "utf8");
  return body.length > maxChars ? `${body.slice(0, maxChars)}\n\n…(truncated)` : body;
}

// Maps exported names to their type-definition files (when the package ships a SOURCE_MAP).
export function sourceMapFor(dir: string, pkg: string, symbol: string): string[] {
  const p = listInstalled(dir).find((x) => x.name === pkg);
  if (!p?.docsDir) return [];
  const f = join(p.docsDir, "assets", "SOURCE_MAP.json");
  if (!existsSync(f)) return [];
  try {
    const map = JSON.parse(readFileSync(f, "utf8")) as { exports?: Record<string, { types?: string }> };
    const e = map.exports?.[symbol];
    return e?.types ? [join(dirname(dirname(p.docsDir)), e.types)] : [];
  } catch {
    return [];
  }
}

interface Registry {
  providers: Record<string, { name?: string; apiKeyEnvVar?: string; models: string[] }>;
}

export function loadRegistry(dir: string): Registry | null {
  const root = findMastraModules(dir);
  const f = root && join(root, "core", "dist", "provider-registry.json");
  if (!f || !existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as Registry;
  } catch {
    return null;
  }
}

function versionOf(name: string): number[] | null {
  for (const m of name.matchAll(/(\d+(?:[.-]\d+)*)([a-zA-Z])?/g)) {
    let parts = m[1].split(/[.-]/).map(Number);
    if (/^[bBkKmMtT]$/.test(m[2] ?? "")) parts = parts.slice(0, -1);
    parts = parts.filter((n) => n < 2020);
    if (parts.length && !(parts.length === 1 && parts[0] >= 100)) return parts;
  }
  return null;
}

export function compareNewest(a: string, b: string): number {
  const va = versionOf(a);
  const vb = versionOf(b);
  if (!va || !vb) return va ? -1 : vb ? 1 : a.localeCompare(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? 0) - (va[i] ?? 0);
    if (d) return d;
  }
  return b.localeCompare(a);
}

export function lookupModels(reg: Registry, provider: string | undefined, query: string | undefined, limit: number): string {
  if (!provider) {
    return Object.entries(reg.providers)
      .map(([k, v]) => `${k}${v.name && v.name !== k ? ` (${v.name})` : ""}: ${v.models.length} models`)
      .sort()
      .join("\n");
  }
  const p = reg.providers[provider];
  if (!p) {
    const near = Object.keys(reg.providers).filter((k) => k.includes(provider.toLowerCase())).slice(0, 5);
    return `Unknown provider "${provider}".${near.length ? ` Did you mean: ${near.join(", ")}?` : " Call lookup_model without arguments to list providers."}`;
  }
  const q = query?.toLowerCase();
  const models = p.models.filter((m) => !q || m.toLowerCase().includes(q)).sort(compareNewest);
  const shown = models.slice(0, limit).map((m) => `${provider}/${m}`);
  return `${p.name ?? provider} (env: ${p.apiKeyEnvVar ?? "n/a"}) — ${models.length} matching models, newest first:\n${shown.join("\n")}`;
}
