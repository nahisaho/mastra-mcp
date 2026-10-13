import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { docCount, indexedAt, openDb, sourceRef } from "./db.js";
import { ensureIndex } from "./indexer.js";
import { resolveVersion } from "./version.js";

export const HELP = `mastra-mcp: MCP server for Mastra docs (stdio)

Usage:
  mastra-mcp            Start the MCP server on stdio
  mastra-mcp refresh    Re-fetch the docs now and rebuild the index
  mastra-mcp status     Show index location, size and age
  mastra-mcp --version | --help

Env:
  MASTRA_MCP_DB       Index file (default ~/.cache/mastra-mcp/index.db; pinned versions use index-<version>.db)
  MASTRA_MCP_VERSION  auto (default: installed @mastra/core in cwd), latest, or x.y.z to pin the docs release`;

export function targetVersion(): string | null {
  return resolveVersion(process.env.MASTRA_MCP_VERSION, process.cwd());
}

export function dbPath(version: string | null = targetVersion()): string {
  const dir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "mastra-mcp");
  return process.env.MASTRA_MCP_DB ?? join(dir, version ? `index-${version}.db` : "index.db");
}

export function version(): string {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
}

export function statusText(file: string): string {
  const db = openDb(file);
  const at = indexedAt(db);
  const age = at ? `${new Date(at).toISOString()} (${((Date.now() - at) / 3600000).toFixed(1)}h ago)` : "never";
  return ["index: " + file, "documents: " + docCount(db), "source: " + (sourceRef(db) ?? "none"), "indexed: " + age].join("\n");
}

// Returns a process exit code; prints to stdout/stderr.
export function runCommand(cmd: string, file: string): number {
  if (cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log(version());
    return 0;
  }
  if (cmd === "status") {
    console.log(statusText(file));
    return 0;
  }
  if (cmd === "refresh") {
    const db = openDb(file);
    const t0 = Date.now();
    const r = ensureIndex(db, undefined, true, targetVersion());
    if (r.error) {
      console.error("refresh failed (previous index kept): " + r.error);
      return 1;
    }
    console.log("refreshed " + docCount(db) + " documents in " + ((Date.now() - t0) / 1000).toFixed(1) + "s -> " + file);
    return 0;
  }
  console.error("Unknown command: " + cmd + "\n\n" + HELP);
  return 2;
}
