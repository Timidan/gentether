# GenTether Architecture

## System boundary

GenTether indexes exactly one repository root selected at process startup. Web requests cannot change that root. This keeps the demo safe and makes its trust boundary explicit.

```text
GENTETHER_REPO
      │
      ▼
Scanner ────────────────┐
  generated evidence    │
  generator declarations│
  source hints           ├──> immutable RepositoryGraph snapshot
  JS/TS imports          │                 │
                        └──────────────────┤
                                           ├──> MemoryGraph fallback
                                           └──> HydraDB adapter
                                                    │
                           ┌────────────────────────┴────────────────────┐
                           ▼                                             ▼
                     Patch gate                                    Lineage API
                 BLOCK/REVIEW/ALLOW                       sources/commands/impact/tests
                           │                                             │
                           └──────────────────┬──────────────────────────┘
                                              ▼
                                     Web UI + MCP server
```

## Graph schema

### Vertices

All HydraDB vertices have label `GenTetherArtifact` and stable non-negative integer ids.

Kinds:

- `repository`
- `file`
- `source_spec`
- `generator_config`
- `generator_command`
- `generated_file`
- `test`

Core properties:

- `id`
- `repository_id`
- `artifact_key`
- `kind`
- `name`
- `path`

### Relationships

| Type | Direction | Meaning |
|---|---|---|
| `CONTAINS` | repository → artifact | Artifact belongs to the indexed repository. |
| `DECLARES` | package/config → command | File declares a generation command. |
| `FEEDS` | source spec → command | Source is input to that generator. |
| `GENERATES` | command → artifact | Command produces that output. |
| `IMPORTS` | importer → dependency | Static JS/TS import. |
| `VERIFIES` | test → imported target | Direct test evidence. |

## Scanner stages

1. **Bounded walk** — ignores dependency/build directories and enforces file-count and file-size limits.
2. **Text classification** — detects source specifications, generator configs, tests and generated evidence.
3. **Command discovery** — reads generation-related `package.json` scripts.
4. **Generator discovery** — understands common GraphQL Codegen, OpenAPI Generator, Orval, Buf and Prisma shapes.
5. **Header provenance** — resolves `Source:` and `Command:` hints from generated comment headers.
6. **Import extraction** — resolves common relative JS/TS imports and creates typed edges.
7. **Warning pass** — reports generated artifacts whose source or command could not be resolved.

Generated phrases inside arbitrary string literals are not accepted as header evidence; only comment-header lines are inspected. This prevents a generator implementation from being classified as one of its own outputs.

## Gate algorithm

### Generated artifact changed

1. Traverse incoming `GENERATES` to generator commands.
2. Traverse incoming `FEEDS` to authoritative sources.
3. Check whether the patch includes a source, command declaration or generator config.
4. No authoritative change → `BLOCK`.
5. Missing provenance → `REVIEW`.
6. Coordinated change → candidate `ALLOW`.

### Source/config changed

1. Traverse to connected generator commands.
2. Traverse `GENERATES` to every expected output.
3. Any expected output absent from the patch → `REVIEW`.
4. All outputs present → candidate `ALLOW`.

### Severity composition

A multi-file patch can trigger multiple findings. Final severity is deterministic:

```text
BLOCK > REVIEW > ALLOW
```

The gate never converts missing evidence into `ALLOW`.

## Downstream impact

For each generated output, GenTether walks incoming `IMPORTS` edges up to four hops. Because import edges point importer → dependency, the in-memory implementation performs a reverse traversal; HydraDB expresses the equivalent as:

```cypher
MATCH (consumer:GenTetherArtifact)-[:IMPORTS*1..4]->(g:GenTetherArtifact)
WHERE g.id = $target
RETURN consumer.id AS consumer_id
LIMIT 200
```

Tests are classified separately from ordinary consumers.

## HydraDB lifecycle

At index time:

1. Delete the previous `GenTetherArtifact` vertices for the repository id.
2. Batch-upsert vertices through `UNWIND`.
3. Batch-upsert each closed relationship type.
4. Execute a count query as a round-trip check.
5. Set `hydraConnected=true` only after all operations succeed.

At query time, GenTether decodes HydraDB's returned `source_id`, `command_id`, `generated_id`, `declaration_id` and `consumer_id` values and rebuilds the live evidence sets from those rows. An `ALLOW`, `BLOCK` or `REVIEW` result is therefore constrained by what the database actually returns, not merely by whether the endpoint answered. Missing source-command-output evidence degrades to `REVIEW`. Transport failure switches to the deterministic snapshot and records a warning.

## Dependency boundaries

- Scanner and gate have no network dependency.
- HydraDB is accessed only by `src/graph/hydra.ts`.
- UI is static HTML/CSS/JS.
- HTTP server uses Node built-ins.
- MCP transport uses JSON-RPC over stdio and exposes only three fixed tools.
- No LLM is required for a decision.

## Security and correctness choices

- Repository root is fixed at startup.
- File traversal ignores symlinks.
- File count, file size, request body and changed-path count are bounded.
- Cypher relationship types come from a closed enum, never user input.
- Queries are fixed and bounded.
- Generated provenance confidence and evidence are retained on graph edges.
- Missing or ambiguous evidence returns `REVIEW`, not `ALLOW`.
