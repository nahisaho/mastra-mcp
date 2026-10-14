# mastra-mcp

MCP server (like Context7) that gives coding agents up-to-date [Mastra](https://github.com/mastra-ai/mastra) docs.

- Tools:
  - `installed_docs`: docs embedded in the project's `node_modules/@mastra/*/dist/docs` (exact installed version; list / search / read / SOURCE_MAP type lookup). Use first when packages are installed.
  - `search_docs`, `get_doc`, `get_api_reference`: latest published docs (results include `mastra.ai/...md` source URLs). Legacy/deprecated pages are ranked after current ones unless the query mentions them. `search_docs` also appends an excerpt of the top page (`excerpt_chars`, default 3000, `0` disables) so a single call is usually enough to start coding.
  - `search_examples`: code blocks from the docs (filter by `lang`), ranked by exact identifiers, heading and page-name matches.
  - `list_topics`: browse the indexed docs by section (no arguments: sections with page counts; `section`: its pages).
  - `get_guide`: curated guides from the official [mastra-ai/skills](https://github.com/mastra-ai/skills) repo (Apache-2.0), fetched at index time: common errors, v0.x→v1 migration, project setup, core concepts, `mastra api` CLI, trace queries, Trace Intelligence, Factory. Also searchable with `search_docs` `kind=guide`.
  - `lookup_model`: verify providers and model names from the installed `@mastra/core` provider registry.
- The server `instructions` carry the Mastra skill's guidance (verify docs, installed docs first, `provider/model` format). Based on [mastra-ai/skills](https://github.com/mastra-ai/skills).
- On first start it sparse-clones the skills repo too and sparse-clones `docs/src/content/en` from `mastra-ai/mastra` (needs `git`), indexes it in SQLite FTS5 and refreshes every 24h. If a refresh fails, the old index is kept.
- Requires Node.js >= 22.16 and `git`. Index location: `~/.cache/mastra-mcp/index.db` (override with `MASTRA_MCP_DB`).

## Install / deploy

Pick one. All variants run over stdio and need Node.js >= 22.16 and `git` (the container bundles both).

| Method | Command |
|---|---|
| npx (after npm publish) | `npx -y mastra-mcp` |
| Global install | `npm install -g mastra-mcp`, then `mastra-mcp` |
| Local checkout | `git clone <repo> && cd mastra-mcp && npm ci && npm run build`, then `node dist/index.js` |
| Container | see [Container](#container) |

The first start builds the docs index (about 5 s, needs network access to GitHub); later starts reuse it.

## MCP client configuration

The server entry is the same everywhere; only the config file differs. Change `command`/`args` to match your deploy method (npx shown).

```json
{ "mcpServers": { "mastra": { "command": "npx", "args": ["-y", "mastra-mcp"] } } }
```

| Client | Where |
|---|---|
| Claude Code | `claude mcp add mastra -- npx -y mastra-mcp` (or `.mcp.json` in the project) |
| Claude Desktop | `claude_desktop_config.json` (`mcpServers`) |
| Cursor | `.cursor/mcp.json` or `~/.cursor/mcp.json` (`mcpServers`) |
| VS Code | `.vscode/mcp.json`; the top-level key is `servers`, not `mcpServers` |
| GitHub Copilot CLI | `~/.copilot/mcp-config.json` (`mcpServers`) |

Variants:

```json
{ "mcpServers": { "mastra": { "command": "node", "args": ["/path/to/mastra-mcp/dist/index.js"] } } }
```

```json
{ "mcpServers": { "mastra": { "command": "docker", "args": ["run", "-i", "--rm", "-v", "mastra-mcp-data:/data", "mastra-mcp"] } } }
```

Pin the docs version or move the index with `env`:

```json
{ "mcpServers": { "mastra": { "command": "npx", "args": ["-y", "mastra-mcp"],
  "env": { "MASTRA_MCP_VERSION": "1.70.0", "MASTRA_MCP_DB": "/path/to/index.db" } } } }
```

Run the client from the project directory so `installed_docs` and `MASTRA_MCP_VERSION=auto` can see `node_modules/@mastra/core`. Check the setup with `mastra-mcp status`.

## Japanese queries

`search_docs`, `search_examples` and `get_api_reference` accept Japanese queries (e.g. `ワークフローを中断して再開する方法`). Known terms are translated to English via a built-in dictionary of 1,000+ terms (`src/ja-terms.ts`, `JA_TERMS` in `src/db.ts`; longest match wins); unknown Japanese is dropped.

## Version-pinned docs

By default the docs match the `@mastra/core` installed in the server's working directory (`node_modules/@mastra/core`); without one, the latest docs are used. Override with `MASTRA_MCP_VERSION`: `auto` (default), `latest`, or an exact release such as `1.70.0`. Docs are fetched from the git tag `@mastra/core@<version>`, cached per version in `index-<version>.db`, and never expire. If the tag does not exist, the latest docs are used instead (`mastra-mcp status` shows the `source`).

## CLI

```sh
mastra-mcp            # start the MCP server on stdio
mastra-mcp refresh    # re-fetch the docs now and rebuild the index
mastra-mcp status     # index path, document count, age
mastra-mcp --version
```

## Container

```sh
docker build -t mastra-mcp .          # or: wslc build -t mastra-mcp .
docker run -i --rm -v mastra-mcp-data:/data mastra-mcp
```

MCP over stdio needs `-i` and no TTY. The `/data` volume caches the docs index (built on first start; needs network access to GitHub). MCP client config: `{"command": "docker", "args": ["run", "-i", "--rm", "-v", "mastra-mcp-data:/data", "mastra-mcp"]}` (use `wslc` instead of `docker` on WSL). In a container, `installed_docs` cannot see the host `node_modules` unless you mount the project and set the working directory (`-v <project>:/work -w /work`).

## Development

```sh
npm test          # type-check + unit/MCP tests
npm run build     # compile src -> dist
npm pack --dry-run
```

Ranking regressions are guarded by golden tests (`test/golden.json`, run against the real-page subset `test/fixtures/docs-subset.json`). After intentionally changing ranking, run `mastra-mcp refresh` with `MASTRA_MCP_DB=/tmp/golden.db`, then `MASTRA_MCP_DB=/tmp/golden.db npm run fixture` to regenerate the fixture.

`npm publish` runs `prepublishOnly` (tests + build) and ships only `dist`, `README.md`, `LICENSE` and `NOTICE`.

## License

Apache-2.0 (see `LICENSE` and `NOTICE`).
