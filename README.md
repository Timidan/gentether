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

Run the deterministic demo:

```bash
npm install --no-audit --no-fund
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

The HydraDB adapter:

- upserts every artifact as a stable integer-id vertex;
- writes `FEEDS`, `GENERATES`, `DECLARES`, `IMPORTS`, `VERIFIES` and `CONTAINS` relationships;
- performs bounded reverse-import traversal for downstream impact;
- performs source-command-output joins for provenance;
- rebuilds live evidence from HydraDB response rows;
- downgrades a decision to `REVIEW` when the live graph cannot prove expected lineage;
- labels an answer `hydradb` only after successful ingestion and retrieval.

Without HydraDB, GenTether loses the persisted typed provenance graph, directed multi-hop impact traversal and database-backed evidence used to justify the gate decision. The local memory implementation exists only as an explicitly labelled development fallback.

Exact queries: [`docs/HYDRA_QUERIES.md`](docs/HYDRA_QUERIES.md).

## Quick start

Requirements:

- Node.js 20+
- npm

```bash
git clone https://github.com/Timidan/gentether.git
cd gentether
npm install --no-audit --no-fund
npm test
npm run build
npm start
```

Open `http://127.0.0.1:8787`.

The default repository is the bundled fixture at `fixtures/checkout-app`. Index another repository with:

```bash
GENTETHER_REPO=/absolute/path/to/repository npm start
```

## Product UI

The browser surface is the judge-facing and human-facing product experience. It includes the live patch gate, generated-artifact lineage trace, repository metrics, HydraDB status, and links to the agent-native tools.

The interface uses flat editorial surfaces, restrained scroll-led motion, a reduced-motion fallback, and pinned Phosphor Icons. The repository audit rejects CSS gradients, decorative status dots, pill-heavy controls, missing icon integration, and missing scroll choreography.

## Run with HydraDB OSS

The repository includes local configuration for HydraDB's official open-source container image.

```bash
bash scripts/start-hydra.sh
npm run build
HYDRA_URL=http://127.0.0.1:8443 \
HYDRA_TOKEN=local-development-token-32-bytes \
GENTETHER_REPO=./fixtures/checkout-app \
npm start
```

Or run the complete stack:

```bash
bash scripts/init-hydra-data.sh
docker compose up --build
```

After HydraDB becomes ready, re-index:

```bash
curl -X POST http://127.0.0.1:8787/api/reindex
curl http://127.0.0.1:8787/api/status
```

The interface changes from `Deterministic fallback · local` to `HydraDB · live` only after graph ingestion succeeds.

Run the dedicated live verification with:

```bash
bash scripts/verify-hydra-live.sh
```

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

| Tool | Use |
|---|---|
| `gentether_resolve_edit_target` | Resolve the source, generation command, outputs, consumers and tests. |
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
| `POST` | `/api/reindex` | Rescan and re-ingest the configured repository root. |
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

## Deliberate MVP boundaries

GenTether does not claim full language-semantic resolution. The current scanner focuses on JavaScript and TypeScript import graphs and generator provenance that can be demonstrated reliably in under three minutes. Dynamic imports, path aliases, reflection and runtime-generated relationships may be unresolved; missing evidence returns `REVIEW`, never a false `ALLOW`.

The application also never lets an LLM generate unrestricted Cypher. Queries are fixed, typed and bounded.

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

The deterministic suite verifies the three gate decisions, multi-hop consumer/test discovery, scanner behavior, HydraDB query construction and live-evidence response decoding. The separate live workflow runs against the official HydraDB OSS image.

## Remotion demo video

The pitch and demo are authored as a **2:25.5 Remotion composition** with synchronized narration and captions.

```bash
npm run video:check
npm run video:narration
npm run video:studio
npm run video:render
```

The output is written to `demo/gentether-demo.mp4`. GitHub Actions also publishes the rendered MP4 as the `gentether-demo-video` workflow artifact.

Video source:

- `video/GenTetherDemo.tsx`
- `video/Root.tsx`
- `video/data.ts`
- `scripts/generate-narration.sh` (creates `public/video/audio/` before rendering)

## Submission readiness

The live requirements checklist is maintained in [`docs/HACKATHON.md`](docs/HACKATHON.md). The repository must be made public and the rendered video must be uploaded to a judge-accessible URL before the official submission form is sent.

## Attribution

- **HydraDB OSS** — [`hydra-db/hydradb`](https://github.com/hydra-db/hydradb), AGPL-3.0. Run as a separate service through its official container image and authenticated HTTP query API. No HydraDB source is vendored.
- **Phosphor Icons Web 2.1.2** — MIT, loaded as pinned regular and fill stylesheets for the browser interface.
- **Remotion 4.0.506** — used to author and render the demo video. Third-party licence terms remain with the upstream project.
- **React / React DOM 19.2.8** — MIT, used only by the Remotion composition.
- **TypeScript 5.9.2** — Apache-2.0, used for the application and video source.
- **Node.js** — runtime for the application, MCP server and build scripts.
- **eSpeak NG** — used by the render workflow to synthesize narration; generated audio is not committed to this repository.
- The bundled `fixtures/checkout-app` corpus and all GenTether application code were authored for this hackathon project. No external dataset is redistributed.

## License

GenTether application source is licensed under MIT. See [`LICENSE`](LICENSE). Third-party dependencies retain their own licences.
