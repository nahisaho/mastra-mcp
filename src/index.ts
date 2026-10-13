#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dbPath, runCommand, targetVersion } from "./cli.js";
import { docCount, openDb } from "./db.js";
import { ensureIndex } from "./indexer.js";
import { createServer } from "./server.js";

const cmd = process.argv[2];

if (cmd) {
  process.exit(runCommand(cmd, dbPath()));
} else {
  const version = targetVersion();
  const db = openDb(dbPath(version));
  // Index in the background so the MCP handshake is not blocked; tools await it.
  const ready = (async () => {
    const r = ensureIndex(db, undefined, false, version);
    if (r.error) console.error("[mastra-mcp] index refresh failed: " + r.error);
    if (docCount(db) === 0) throw new Error("Mastra docs index is empty (initial fetch failed; is git installed and GitHub reachable?)");
  })();
  ready.catch(() => {});
  await createServer(db, () => ready).connect(new StdioServerTransport());
}
