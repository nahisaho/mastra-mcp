# mastra-mcp

MCP server (like Context7) that gives coding agents up-to-date [Mastra](https://github.com/mastra-ai/mastra) docs.

- Tools:
  - `installed_docs`: docs embedded in the project's `node_modules/@mastra/*/dist/docs` (exact installed version; list / search / read / SOURCE_MAP type lookup). Use first when packages are installed.
  - `search_docs`, `get_doc`, `get_api_reference`: latest published docs (results include `mastra.ai/...md` source URLs). Legacy/deprecated pages are ranked after current ones unless the query mentions them.
  - `search_examples`: code blocks from the docs (filter by `lang`), ranked by exact identifiers, heading and page-name matches.
  - `get_guide`: curated guides from the official [mastra-ai/skills](https://github.com/mastra-ai/skills) repo (Apache-2.0), fetched at index time: common errors, v0.x→v1 migration, project setup, core concepts, `mastra api` CLI, trace queries, Trace Intelligence, Factory. Also searchable with `search_docs` `kind=guide`.
  - `lookup_model`: verify providers and model names from the installed `@mastra/core` provider registry.
- The server `instructions` carry the Mastra skill's guidance (verify docs, installed docs first, `provider/model` format). Based on [mastra-ai/skills](https://github.com/mastra-ai/skills).
- On first start it sparse-clones the skills repo too and sparse-clones `docs/src/content/en` from `mastra-ai/mastra` (needs `git`), indexes it in SQLite FTS5 and refreshes every 24h. If a refresh fails, the old index is kept.
- Requires Node.js >= 22.5 and `git`. Index location: `~/.cache/mastra-mcp/index.db` (override with `MASTRA_MCP_DB`).

## Usage

MCP client config (after publishing to npm):

```json
{ "mcpServers": { "mastra": { "command": "npx", "args": ["-y", "mastra-mcp"] } } }
```

From a local checkout (`npm install && npm run build`), use `{ "command": "node", "args": ["<repo>/dist/index.js"] }`.

## Japanese queries

`search_docs` / `search_examples` accept Japanese queries (e.g. `ワークフローを中断して再開する方法`). Known terms are translated to English via a built-in dictionary of 1,000+ terms (`src/ja-terms.ts`, `JA_TERMS` in `src/db.ts`; longest match wins); unknown Japanese is dropped.

## Version-pinned docs

By default the docs match the `@mastra/core` installed in the server's working directory (`node_modules/@mastra/core`); without one, the latest docs are used. Override with `MASTRA_MCP_VERSION`: `auto` (default), `latest`, or an exact release such as `1.70.0`. Docs are fetched from the git tag `@mastra/core@<version>`, cached per version in `index-<version>.db`, and never expire. If the tag does not exist, the latest docs are used instead (`mastra-mcp status` shows the `source`).

## CLI

```sh
mastra-mcp            # start the MCP server on stdio
mastra-mcp refresh    # re-fetch the docs now and rebuild the index
mastra-mcp status     # index path, document count, age
mastra-mcp --version
```

## Development

```sh
npm test          # type-check + unit/MCP tests
npm run build     # compile src -> dist
npm pack --dry-run
```

Ranking regressions are guarded by golden tests (`test/golden.json`, run against the real-page subset `test/fixtures/docs-subset.json`). After intentionally changing ranking, run `mastra-mcp refresh` with `MASTRA_MCP_DB=/tmp/golden.db`, then `MASTRA_MCP_DB=/tmp/golden.db npm run fixture` to regenerate the fixture.

`npm publish` runs `prepublishOnly` (tests + build) and ships only `dist`, `README.md` and `LICENSE`.
