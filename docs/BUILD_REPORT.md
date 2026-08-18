# GenTether Build Report

**Verification date:** 2026-08-18  
**Hackathon:** Hack Hydra 2026  
**Track:** 02B — Code Graphs for IDE Assistants

## Delivered

- dependency-light Node.js/TypeScript application;
- generated-code provenance scanner;
- typed repository graph and deterministic fallback;
- HydraDB HTTP ingestion and bounded traversal adapter;
- live gate rebuilt from HydraDB response rows;
- `BLOCK`, `REVIEW` and `ALLOW` patch decisions;
- web interface, HTTP API and three MCP tools;
- bundled multi-hop demo fixture;
- Docker and GitHub Actions configuration;
- MIT licence, architecture notes, demo script and submission checklist.

## Automated verification

Command:

```bash
npm test
```

Result on 2026-08-18:

```text
9 tests
9 passed
0 failed
```

Coverage includes:

1. direct generated-file edit returns `BLOCK`;
2. source-only change returns `REVIEW`;
3. coordinated source-plus-output change returns `ALLOW`;
4. exact multi-hop consumer and test chain;
5. HydraDB typed node and relationship writes plus bounded traversal response decoding;
6. live gate reconstructed from returned HydraDB ids;
7. incomplete live provenance downgrades a local `BLOCK` to `REVIEW`;
8. scanner builds the expected provenance graph;
9. generated string literals do not create a false generated-file classification.

## Runtime smoke checks

### HTTP application

- `GET /api/status` returned 8 files, 1 generated file, 1 source specification, 1 command and 15 relationships.
- `POST /api/analyze` with `src/generated/api-client.ts` returned `BLOCK`.
- The web application served the expected GenTether title.

### MCP server

- JSON-RPC initialization succeeded.
- `tools/list` returned all three GenTether tools.
- `gentether_check_patch` returned structured `BLOCK` evidence for the generated-client edit.

### Demo

`npm run demo` returned the intended sequence:

```text
Generated output only                -> BLOCK
Authoritative source only            -> REVIEW
Source plus regenerated output       -> ALLOW
```

## HydraDB verification boundary

Docker is not installed in the build environment used for this report, so a real HydraDB container was not started here. The adapter is tested with protocol-shaped HTTP responses containing HydraDB's typed `columns` and `rows` values, including ingestion queries, relationship writes, bounded import traversal and fail-closed gate behavior.

Before recording the final submission, run the repository's live Docker path and confirm:

```json
{
  "engine": "hydradb",
  "hydraConnected": true
}
```

The application never labels the deterministic fallback as HydraDB.

## Repository state

The source is prepared for a fresh event-window initial commit. The final submission repository must be public even if it is kept private during preparation.
