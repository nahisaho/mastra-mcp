import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { extractExamples } from "./examples.js";

export interface DocRow {
  path: string;
  kind: "docs" | "reference" | "guide";
  title: string;
  description: string;
  packages: string;
  body: string;
  headings?: string;
  imports?: string;
}

export interface SearchHit {
  path: string;
  kind: string;
  title: string;
  description: string;
  snippet: string;
}

const SCHEMA_VERSION = 5;

export function openDb(file: string): DatabaseSync {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  const v = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  if (v !== SCHEMA_VERSION) {
    db.exec("DROP TABLE IF EXISTS meta; DROP TABLE IF EXISTS docs; DROP TABLE IF EXISTS docs_fts; DROP TABLE IF EXISTS examples_fts;");
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS docs (
      path TEXT PRIMARY KEY, kind TEXT, title TEXT, description TEXT, packages TEXT, body TEXT, headings TEXT, imports TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      path UNINDEXED, title, description, packages, body, tokenize = 'porter unicode61'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS examples_fts USING fts5(
      path UNINDEXED, kind UNINDEXED, lang UNINDEXED, heading, code, tokenize = 'unicode61'
    );
  `);
  return db;
}

export function replaceAll(db: DatabaseSync, rows: DocRow[]): void {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM docs; DELETE FROM docs_fts; DELETE FROM examples_fts;");
    const ex = db.prepare("INSERT INTO examples_fts VALUES (?,?,?,?,?)");
    const ins = db.prepare("INSERT INTO docs VALUES (?,?,?,?,?,?,?,?)");
    const fts = db.prepare("INSERT INTO docs_fts VALUES (?,?,?,?,?)");
    for (const r of rows) {
      ins.run(r.path, r.kind, r.title, r.description, r.packages, r.body, r.headings ?? "", r.imports ?? "");
      fts.run(r.path, r.title, r.description, r.packages, r.body);
      for (const e of extractExamples(r.body, r.title)) ex.run(r.path, r.kind, e.lang, e.heading, e.code);
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('indexed_at', ?)").run(String(Date.now()));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function indexedAt(db: DatabaseSync): number | null {
  const r = db.prepare("SELECT value FROM meta WHERE key='indexed_at'").get() as { value: string } | undefined;
  return r ? Number(r.value) : null;
}

export function docCount(db: DatabaseSync): number {
  return (db.prepare("SELECT count(*) AS n FROM docs").get() as { n: number }).n;
}

const STOP = new Set(["the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "with", "how", "do", "i", "is", "are", "use", "using"]);

// Japanese -> English term map; the docs are English-only, so known terms are translated and other Japanese is dropped.
const JA_TERMS: Record<string, string> = {
  ワークフロー: "workflow", エージェント: "agent", メモリー: "memory", メモリ: "memory", ツール: "tool",
  評価: "evals", スコアラー: "scorer", 認証: "auth", 認可: "authorization", ストリーミング: "streaming",
  ストリーム: "stream", 再開: "resume", 中断: "suspend", 一時停止: "suspend", 承認: "approval",
  ベクトル: "vector", 検索: "search", ストレージ: "storage", データベース: "database", デプロイ: "deploy",
  ネットワーク: "network", サーバー: "server", ミドルウェア: "middleware", モデル: "model", プロンプト: "prompt",
  指示: "instructions", 構造化出力: "structured output", 出力: "output", 入力: "input", 型: "schema",
  スキーマ: "schema", トレース: "tracing", 可観測性: "observability", ログ: "logging", 音声: "voice",
  テスト: "testing", エラー: "error", 設定: "configuration", 作成: "create", 実行: "run",
  並列: "parallel", 分岐: "branch", ループ: "loop", 待機: "sleep", 人間: "human", 介入: "human in the loop",
  ガードレール: "processors", プロセッサー: "processors", 運用: "production", 環境変数: "environment variables",
  使い方: "", 方法: "", 実装: "", 作り方: "",
};
const JA_KEYS = Object.keys(JA_TERMS).sort((a, b) => b.length - a.length);
const JA_RUN = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]+/gu;

export function translateJa(q: string): string {
  if (!JA_RUN.test(q)) return q;
  JA_RUN.lastIndex = 0;
  let out = q;
  for (const k of JA_KEYS) out = out.split(k).join(` ${JA_TERMS[k]} `);
  const stripped = out.replace(JA_RUN, " ").replace(/\s+/g, " ").trim();
  return stripped || q;
}

export function toFtsQuery(q: string, joiner: "OR" | "AND" = "OR"): string {
  q = translateJa(q);
  const all = q.match(/[\p{L}\p{N}_]+/gu) ?? [];
  const kept = all.filter((t) => !STOP.has(t.toLowerCase()));
  return (kept.length ? kept : all).map((t) => `"${t}"`).join(` ${joiner} `);
}

function runSearch(db: DatabaseSync, match: string, kind: string | undefined, limit: number): SearchHit[] {
  const sql = `
    SELECT f.path, d.kind, d.title, d.description,
           snippet(docs_fts, 4, '[', ']', '…', 24) AS snippet
    FROM docs_fts f JOIN docs d ON d.path = f.path
    WHERE docs_fts MATCH ? ${kind ? "AND d.kind = ?" : ""}
    ORDER BY bm25(docs_fts, 0, 10, 4, 2, 1)
    LIMIT ?`;
  const args: (string | number)[] = kind ? [match, kind, limit] : [match, limit];
  return db.prepare(sql).all(...args) as unknown as SearchHit[];
}

// Pages containing every term rank first; OR matches only fill the remaining slots.
export function search(db: DatabaseSync, query: string, kind: string | undefined, limit: number): SearchHit[] {
  const and = toFtsQuery(query, "AND");
  if (!and) return [];
  const hits = runSearch(db, and, kind, limit * 2);
  const seen = new Set(hits.map((h) => h.path));
  const or = hits.length >= limit ? [] : runSearch(db, toFtsQuery(query, "OR"), kind, limit * 2).filter((h) => !seen.has(h.path));
  return demoteLegacy([...hits, ...or], query).slice(0, limit);
}

const isLegacy = (path: string, title: string) => /legacy|deprecated/i.test(`${path} ${title}`);

// Stable partition: legacy/deprecated pages go after current ones unless the query asks for them.
function demoteLegacy<T extends { path: string; title: string }>(hits: T[], query: string): T[] {
  if (/legacy|deprecated/i.test(query)) return hits;
  return [...hits.filter((h) => !isLegacy(h.path, h.title)), ...hits.filter((h) => isLegacy(h.path, h.title))];
}

export interface ExampleHit {
  path: string;
  lang: string;
  heading: string;
  code: string;
}

const termsOf = (q: string) => (translateJa(q).match(/[\p{L}\p{N}_]+/gu) ?? []).filter((t) => !STOP.has(t.toLowerCase()));

// FTS finds candidates; re-ranking favours exact identifiers, heading matches, short snippets and primary docs.
export function searchExamples(db: DatabaseSync, query: string, lang: string | undefined, limit: number): ExampleHit[] {
  const and = toFtsQuery(query, "AND");
  if (!and) return [];
  const run = (match: string, n: number) =>
    db
      .prepare(
        `SELECT path, lang, heading, code FROM examples_fts
         WHERE examples_fts MATCH ? ${lang ? "AND lang = ?" : ""}
         ORDER BY bm25(examples_fts, 0, 0, 0, 6, 1) LIMIT ?`,
      )
      .all(...(lang ? [match, lang, n] : [match, n])) as unknown as ExampleHit[];
  const hits = run(and, 60);
  const seen = new Set(hits.map((h) => h.path + h.code));
  const all = hits.length >= limit ? hits : [...hits, ...run(toFtsQuery(query, "OR"), 60).filter((h) => !seen.has(h.path + h.code))];
  const ts = termsOf(query);
  const wantLegacy = /legacy|deprecated/i.test(query);
  const score = (h: ExampleHit) => {
    const head = h.heading.toLowerCase();
    let sc = 0;
    for (const t of ts) {
      if (h.code.includes(t)) sc += 10;
      else if (h.code.toLowerCase().includes(t.toLowerCase())) sc += 6;
      if (head.includes(t.toLowerCase())) sc += 5;
      if (norm(h.path).includes(norm(t))) sc += 8;
    }
    if (/^(docs|reference)\//.test(h.path)) sc += 5;
    if (!wantLegacy && isLegacy(h.path, h.heading)) sc -= 30;
    return sc - Math.min(10, h.code.length / 400);
  };
  const ranked = all.map((h, i) => ({ h, sc: score(h), i })).sort((a, b) => b.sc - a.sc || a.i - b.i);
  // At most 2 examples per page so one page cannot fill the result list.
  const perPage = new Map<string, number>();
  return ranked
    .filter(({ h }) => {
      const n = (perPage.get(h.path) ?? 0) + 1;
      perPage.set(h.path, n);
      return n <= 2;
    })
    .slice(0, limit)
    .map((x) => x.h);
}

export function getDoc(db: DatabaseSync, path: string): DocRow | undefined {
  const p = path.replace(/^\/+/, "").replace(/\.mdx?$/, "");
  return db
    .prepare("SELECT * FROM docs WHERE path = ? OR path = ? || '/index'")
    .get(p, p) as unknown as DocRow | undefined;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function cleanTitle(title: string): string {
  return title
    .replace(/^Reference:\s*/i, "")
    .replace(/\s*\|.*$/, "")
    .replace(/\(.*$/, "")
    .replace(/\s+(class|api)$/i, "")
    .trim();
}

// "LibSQLStore" -> "libsql": drop generic suffixes so integration pages named after the backend match.
export function stemOf(n: string): string {
  const stem = n.replace(/(store|storage|client|provider|adapter|class|vector)+$/, "");
  return stem.length >= 4 && stem !== n ? stem : "";
}

export function scoreReference(d: DocRow, symbol: string): number {
  const sym = symbol.trim().toLowerCase();
  const n = norm(symbol);
  const lastNorm = norm(d.path.split("/").pop() ?? "");
  const name = norm(cleanTitle(d.title));
  const factory = n.match(/^(?:create|new|get)(.{3,})$/)?.[1];
  const stem = stemOf(n);
  let score = d.kind === "reference" ? 5 : 0;
  if (stem && (name === stem || lastNorm === stem)) score += 75;
  else if (stem && (name.includes(stem) || lastNorm.includes(stem))) {
    // Prefer pages whose name is mostly the stem (postgresql over neon-postgres).
    const shortest = Math.min(...[name, lastNorm].filter((x) => x.includes(stem)).map((x) => x.length));
    score += 50 + Math.round((stem.length / shortest) * 20);
  }
  if (name === n) score += 100;
  if (lastNorm === n || lastNorm === `${n}class`) score += 90;
  if (factory && (name === factory || lastNorm === `create${factory}`)) score += 85;
  if (d.headings?.includes(` ${sym} `)) score += 60;
  if (d.imports?.includes(` ${sym} `)) score += 40;
  if (name.includes(n)) score += 20;
  if (lastNorm.includes(n)) score += 15;
  if (new RegExp(`\\b${sym.replace(/[^\w]/g, "")}\\b`, "i").test(d.body)) score += 5;
  if (d.path.includes("/migrations/") || d.path.includes("upgrade-to")) score -= 200;
  if (!/legacy|deprecated/i.test(symbol) && isLegacy(d.path, d.title)) score -= 60;
  return score;
}

export function referenceFor(db: DatabaseSync, symbol: string, limit: number): DocRow[] {
  const s = symbol.trim().toLowerCase();
  if (!s) return [];
  const rows = db
    .prepare(
      `SELECT * FROM docs WHERE (
         headings LIKE ? ESCAPE '\\' OR imports LIKE ? ESCAPE '\\' OR lower(title) LIKE ? ESCAPE '\\' OR lower(path) LIKE ? ESCAPE '\\'
         OR instr(lower(body), ?) > 0)`,
    )
    .all(`% ${esc(s)} %`, `% ${esc(s)} %`, `%${esc(s)}%`, `%${esc(s)}%`, s) as unknown as DocRow[];
  const compact = s.replace(/[^a-z0-9]/g, "");
  const extra = compact !== s
    ? (db.prepare("SELECT * FROM docs WHERE lower(replace(replace(path,'-',''),'/','')) LIKE ?").all(`%${esc(compact)}`) as unknown as DocRow[])
    : [];
  const factory = compact.match(/^(?:create|new|get)(.{3,})$/)?.[1];
  const fac = factory
    ? (db.prepare("SELECT * FROM docs WHERE (lower(replace(path,'-','')) LIKE ? OR lower(replace(path,'-','')) LIKE ?)").all(`%/${esc(factory)}`, `%/create${esc(factory)}`) as unknown as DocRow[])
    : [];
  const stem = stemOf(compact);
  const stemRows = stem
    ? (db.prepare("SELECT * FROM docs WHERE lower(replace(path,'-','')) LIKE ?").all(`%${esc(stem)}%`) as unknown as DocRow[])
    : [];
  const seen = new Set<string>();
  return [...rows, ...extra, ...fac, ...stemRows]
    .filter((r) => r.kind !== "guide" && !seen.has(r.path) && seen.add(r.path))
    .map((r) => ({ r, score: scoreReference(r, symbol) }))
    .filter((x) => x.score > 5)
    .sort((a, b) => b.score - a.score || a.r.path.length - b.r.path.length)
    .filter((x, _i, all) => x.score >= all[0].score * 0.5)
    .slice(0, limit)
    .map((x) => x.r);
}

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export function listGuides(db: DatabaseSync): { path: string; title: string; description: string }[] {
  return db.prepare("SELECT path, title, description FROM docs WHERE kind='guide' ORDER BY path").all() as unknown as {
    path: string;
    title: string;
    description: string;
  }[];
}

// Accepts a full path ('guides/mastra/common-errors') or a short topic ('common-errors').
export function findGuide(db: DatabaseSync, topic: string): DocRow | undefined {
  const t = topic.trim().toLowerCase().replace(/^\/+|\.md$/g, "");
  const rows = db.prepare("SELECT * FROM docs WHERE kind='guide'").all() as unknown as DocRow[];
  return rows.find((r) => r.path === t) ?? rows.find((r) => r.path.endsWith(`/${t}`)) ?? rows.find((r) => r.path.includes(t));
}
