import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SEMVER = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

export function tagFor(version: string): string {
  return `@mastra/core@${version}`;
}

export function detectInstalledVersion(cwd: string): string | null {
  const file = join(cwd, "node_modules", "@mastra", "core", "package.json");
  if (!existsSync(file)) return null;
  try {
    const v = JSON.parse(readFileSync(file, "utf8")).version;
    return typeof v === "string" && SEMVER.test(v) ? v : null;
  } catch {
    return null;
  }
}

// MASTRA_MCP_VERSION: unset/"auto" -> installed @mastra/core in cwd (else latest); "latest" -> main; "1.70.0" or "v1.70.0" -> that release.
// Returns null for the latest docs (default branch).
export function resolveVersion(env: string | undefined, cwd: string): string | null {
  const v = (env ?? "auto").trim().replace(/^v/, "");
  if (v === "" || v === "auto") return detectInstalledVersion(cwd);
  if (v === "latest" || v === "main") return null;
  if (!SEMVER.test(v)) throw new Error(`Invalid MASTRA_MCP_VERSION: ${env} (use auto, latest or x.y.z)`);
  return v;
}
