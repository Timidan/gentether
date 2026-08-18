# GenTether

> **Edit the source. Never the artifact.**

GenTether is a graph-native provenance gate for coding agents. It detects when a proposed patch touches generated code, traces that artifact back to the schema, template or declaration that owns it, returns the exact regeneration command, and walks downstream imports to the consumers and tests that should be verified.

Built for **Hack Hydra 2026 · Track 02B: Code Graphs for IDE Assistants**.

## The problem

Generated code is deceptively editable. A coding agent can change a generated API client, ORM model, SDK binding or type file, pass a narrow local check, and still create a patch that disappears on the next regeneration run.

Comments such as `DO NOT EDIT` are hints. GenTether turns provenance into an enforceable workflow:

1. Index the repository.
2. Build typed source → command → generated-output relationships.
3. Traverse reverse imports to affected consumers and tests.
4. Gate the proposed patch before the agent writes or merges it.

## The three decisions

| Proposed patch | Decision | Why |
|---|---:|---|
| `src/generated/api-client.ts` | **BLOCK** | The derived file changed without its authoritative source. |
| `api/openapi.yaml` | **REVIEW** | The source changed, but the generated output is missing. |
| Both files | **ALLOW** | Source and generated output changed together. |

Run the exact demo:

```bash
npm install
npm run demo
```

## Why HydraDB is load-bearing

GenTether is not semantic search with a graph visualization added afterward. Its answer depends on typed reachability:

```text
SourceSpec ──FEEDS──────> GeneratorCommand
GeneratorCommand ──GENERATES──> GeneratedArtifact
Consumer ──IMPORTS─────> GeneratedArtifact
Test ──IMPORTS*1..4────> GeneratedArtifact
```

The live HydraDB adapter:

- upserts every artifact as a stable integer-id vertex;
- writes `FEEDS`, `GENERATES`, `DECLARES`, `IMPORTS`, `VERIFIES` and `CONTAINS` relationships;
- executes bounded reverse-import traversal for downstream impact;
- executes source-command-output joins for provenance;
- rebuilds live source, command, output, consumer and test sets from HydraDB response rows;
- downgrades a decision to `REVIEW` when the live graph cannot prove the expected lineage;
- labels an answer `hydradb` only after a successful live round trip.

When HydraDB is absent, GenTether uses the same deterministic snapshot in memory and clearly labels the engine `memory`. The fallback keeps local development usable without pretending the sponsor integration is active.

See [`docs/HYDRA_QUERIES.md`](docs/HYDRA_QUERIES.md) for the exact queries.

## Quick start

Requirements:

- Node.js 20+
- TypeScript 5.9+ through `npm install`

```bash
git clone <your-repository-url>
cd gentether
npm install
npm test
npm run build
npm start
```

Open `http://127.0.0.1:8787`.

The default repository is the bundled fixture at `fixtures/checkout-app`. Index another repository with:

```bash
GENTETHER_REPO=/absolute/path/to/repository npm start
```

## Run with HydraDB

The repository includes Docker configuration based on HydraDB's local-development runtime.

```bash
bash scripts/start-hydra.sh
npm run build
HYDRA_URL=http://127.0.0.1:8443 \
HYDRA_TOKEN=local-development-token-32-bytes \
GENTETHER_REPO=./fixtures/checkout-app \
npm start
```

Or run both services:

```bash
bash scripts/init-hydra-data.sh
docker compose up --build
```

After HydraDB becomes ready, use the circular re-index button in the web app or call:

```bash
curl -X POST http://127.0.0.1:8787/api/reindex
```

The status pill will change from `Deterministic fallback · local` to `HydraDB · live` only after graph ingestion succeeds.

## Agent integration through MCP

Build once:

```bash
npm run build
```

Example MCP configuration:

```json
{
  "mcpServers": {
    "gentether": {
      "command": "node",
      "args": ["/absolute/path/to/gentether/dist/src/mcp.js"],
      "env": {
        "GENTETHER_REPO": "/absolute/path/to/your/repository",
        "HYDRA_URL": "http://127.0.0.1:8443",
        "HYDRA_TOKEN": "local-development-token-32-bytes"
      }
    }
  }
}
```

Tools:

| Tool | Use |
|---|---|
| `gentether_resolve_edit_target` | Resolve the real source, generation command, outputs, consumers and tests. |
| `gentether_check_patch` | Return `BLOCK`, `REVIEW` or `ALLOW` before a patch is written. |
| `gentether_plan_regeneration` | Produce the regeneration and verification plan. |

The stdio server supports JSON-RPC initialization, `tools/list`, `tools/call`, `ping`, newline-delimited messages and `Content-Length` framing.

## HTTP API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/status` | Graph stats, warnings and active engine. |
| `GET` | `/api/generated` | Detected generated artifacts. |
| `GET` | `/api/lineage?file=...` | Provenance and downstream impact. |
| `POST` | `/api/analyze` | Gate `{ "changedFiles": [...] }`. |
| `POST` | `/api/reindex` | Rescan and re-ingest the allowed repository root. |
| `GET` | `/api/demo` | Return all three demo scenarios. |

The API does not accept an arbitrary repository path. The allowed root is fixed at process startup through `GENTETHER_REPO`.

## Detection currently supported

The MVP recognizes:

- generated comment headers such as `@generated`, `AUTO-GENERATED` and `DO NOT EDIT`;
- common generated directories and filenames;
- `.gitattributes` entries using `linguist-generated`;
- generation scripts in `package.json`;
- GraphQL Code Generator, OpenAPI Generator, Orval, Buf and Prisma configuration patterns;
- source hints and regeneration commands embedded in generated headers;
- JavaScript and TypeScript static imports, including multi-hop reverse traversal to tests.

## Deliberate MVP cuts

GenTether does **not** claim full language-semantic resolution. The current scanner focuses on JavaScript/TypeScript import graphs and generator provenance that can be demonstrated reliably in under three minutes. Future adapters can add compiler-backed call graphs, Bazel actions, Gradle tasks, protobuf descriptors and cross-repository contracts without changing the gate model.

It also does not let an LLM generate unrestricted Cypher. Queries are fixed, typed and bounded.

## Architecture

```text
Repository scanner
  ├─ generated-file evidence
  ├─ generator declarations
  ├─ source / command / output lineage
  └─ static import edges
             │
             ▼
      RepositoryGraph snapshot
        ├─ MemoryGraph fallback
        └─ HydraDB HTTP adapter
             │
             ├─ Web API + visual demo
             └─ MCP patch gate
```

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Testing

```bash
npm test
```

The test suite covers:

- exact source → command → output extraction;
- generated-string false-positive prevention;
- all three patch-gate decisions;
- multi-hop consumer and test traversal;
- HydraDB node/relationship writes and bounded query construction;
- HydraDB response-row decoding and live gate reconstruction;
- fail-closed downgrade when live provenance is incomplete.

The live HydraDB integration requires Docker and is separate from the deterministic unit suite.

## Demo and submission material

- [`docs/IDEATION.md`](docs/IDEATION.md) — adversarial idea selection and saturation scan
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — sub-three-minute demo script
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, boundaries and failure modes
- [`docs/HYDRA_QUERIES.md`](docs/HYDRA_QUERIES.md) — exact load-bearing graph operations
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) — final Hack Hydra checklist
- [`docs/BUILD_REPORT.md`](docs/BUILD_REPORT.md) — dated verification record and known limits

## License

MIT. See [`LICENSE`](LICENSE).
