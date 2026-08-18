# GenTether Ideation Record

## Goal

Choose a Hack Hydra project that is ecosystem-native, useful after the event, visually demoable, technically achievable in the remaining build window, and not a near-clone of visible submissions.

The selection process followed the uploaded **Hackathon Unsaturated Ideation** workflow: build a source pack, separate hard constraints, map native needs, scan saturation, generate 8–12 candidates, apply kill filters, score survivors, and lock one build direction.

## Hard constraints

| Constraint | Build consequence |
|---|---|
| HydraDB must perform a meaningful part of the application | Typed provenance and bounded reachability are core decisions, not decorative storage. |
| Track 02B asks for code graphs that improve IDE/coding-assistant context | The product must change an agent action, not merely display repository analytics. |
| Public repository, setup instructions, open-source licence and demo video are required at submission | The repo includes an MIT licence, README, Docker path and a sub-three-minute script. |
| Participant-written commits must fall within the event window | The repository should be created fresh and its first commit made during the event. |
| Product completeness and originality matter alongside technical execution | The MVP includes a polished UI, API, MCP surface, fixture, tests and an explicit saturation record. |

## Saturation scan

Visible projects already cover several obvious readings of the tracks:

| Crowded surface | Examples found | Decision |
|---|---|---|
| Diff-to-impact and coding-agent change gates | Seismic | Reject direct clone. |
| Graph quality and safe test selection | Substrate Friction | Reject test-selection gate. |
| Dependency and supply-chain blast radius | PatientZero, Kudzu, Hindsight | Reject Track 02A blast-radius dashboard. |
| Enterprise conflict/ontology graphs | ContextGate, Cartograph, Belief Graph, Glasshouse, X-Ray | Reject generic enterprise context graph. |
| Long-session memory graphs | Palimpsest, HydraMem | Reject generic memory reconciliation. |
| Safe deletion / dead-code analysis | Existing static-analysis products and code graph tools | Keep only as weaker finalist. |
| API contract drift and coordinated migration | Existing contract-testing and schema-diff products | Keep only as narrower finalist. |
| Generated-code provenance enforcement | Some lineage notes and “do not edit” conventions exist, but no visible Hack Hydra near-clone combining a pre-write gate, source-command-output traversal, downstream impact and MCP enforcement | Advance. |

## Raw candidates considered

1. Generic codebase impact map.
2. Graph-based affected-test selector.
3. Supply-chain blast-radius explorer.
4. Enterprise context conflict resolver.
5. Long-session memory contradiction graph.
6. Safe-delete certificate for symbols and files.
7. Cross-repository API contract migration planner.
8. Environment/configuration lineage guard.
9. Architecture-boundary gate for coding agents.
10. Generated-code provenance gate.
11. Multi-step regeneration sequence planner.

Candidates 1–5 were killed because they overlap visible, polished entrants. Candidate 9 was useful but too close to existing architecture-lint tooling. Candidate 11 was folded into candidate 10 as the regeneration-planning surface.

## Scored finalists

Scores are 1–5 across ecosystem fit, sponsor fit, user value, business fit, agentic depth, integration depth, real-world path, demo clarity, feasibility, differentiation and saturation resistance. Maximum: 55.

| Finalist | Score | Strength | Main penalty |
|---|---:|---|---|
| **GenTether — generated-code provenance gate** | **50/55** | Very clear agent decision, typed graph is load-bearing, strong three-state demo, low dependency risk | Initial scanner is language-limited. |
| ContractWeave — coordinated API migration planner | 45/55 | Strong cross-repo value and graph-native sequencing | Contract-testing/schema-diff space is crowded; cross-repo demo is broader. |
| PruneProof — safe-delete certificate | 41/55 | Easy user value and bounded traversal | Dead-code and “safe to delete” tools already occupy much of the surface. |

## Recommended winner: GenTether

**One sentence:** GenTether stops coding agents from editing generated artifacts directly by tracing each target to its authoritative source and regeneration command, then mapping downstream consumers and tests before allowing the patch.

### Why it fits Track 02B

A coding assistant needs more than similar snippets. It needs to know that:

- a visible TypeScript file is derived, not authoritative;
- an OpenAPI schema owns the change;
- a specific command regenerates the output;
- multiple consumers import that output;
- a downstream test verifies the resulting path.

Those are typed relationships and bounded paths. They directly determine the agent's next action.

### Why it is not merely the obvious RFB example

The obvious Track 02B build is “show what breaks when a file changes.” GenTether starts one layer earlier: **is this even the file the agent is allowed to edit?**

Its primary demo moment is not a large dependency graph. It is a deterministic refusal:

```text
Agent proposes patch to generated client
→ GenTether returns BLOCK
→ graph proves schema → command → generated file
→ reverse traversal returns consumers and tests
→ corrected source + regenerated output returns ALLOW
```

### Real user and business loop

Primary users are teams that maintain generated SDKs, API clients, protobuf bindings, ORM clients, infrastructure manifests and schema-derived types.

Open-source wedge:

- local CLI/core;
- MCP server for coding agents;
- CI patch gate.

Commercial path:

- hosted multi-repository provenance graph;
- policy packs and audit history;
- organization-wide generator inventory;
- pull-request checks and ownership routing.

The buyer is an engineering platform or developer productivity team. The value is reduced agent rework, fewer regeneration regressions and clearer review evidence.

## MVP scope

Built:

- JavaScript/TypeScript repository scanner;
- generated-header, path and `.gitattributes` detection;
- package script and common generator-config discovery;
- source → command → output provenance;
- multi-hop reverse import graph;
- BLOCK / REVIEW / ALLOW patch gate;
- HydraDB HTTP ingestion and bounded queries;
- deterministic memory fallback with visible engine label;
- web demo, HTTP API and MCP server;
- fixture and automated tests.

Cut:

- compiler-resolved calls;
- every language and build system;
- GitHub App installation flow;
- hosted multi-repository indexing;
- automatic patch rewriting.

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| HydraDB is unavailable during local presentation | Deterministic fallback remains usable and visibly labelled; re-index reconnects when HydraDB returns. |
| Generator config is too dynamic to parse statically | Generated-file header and package-script evidence can establish provenance; unresolved artifacts return REVIEW, never a false ALLOW. |
| Import graph misses dynamic imports or aliases | The MVP supports common relative JS/TS imports and describes its limit; missing evidence degrades to REVIEW. |
| Demo repository is too simple | The fixture intentionally contains source, command, generated output, two consumer hops and a test so every graph relation is visible in under three minutes. |
| Product seems like a linter | The differentiator is the typed source-command-output graph plus downstream impact and agent gate, not only a `DO NOT EDIT` regex. |
