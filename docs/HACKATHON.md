# Hack Hydra 2026 Submission Gate

This file is the single source of truth for GenTether's Hack Hydra submission status.

**Project:** GenTether  
**Track:** 02B — Code Graphs for IDE Assistants  
**Official build window:** August 12–20, 2026  
**Deadline:** August 20, 2026 at 11:59 PM Pacific Time  
**Converted deadline:** August 21, 2026 at 09:59 Europe/Athens / 07:59 Africa/Lagos  
**Target internal submission time:** at least three hours before the official deadline

## Source pack

| Source | What it controls | Status |
|---|---|---|
| [Hack Hydra official page](https://hackhydra.hydradb.com/) | Tracks, rules, judging criteria, deliverables, deadline and disqualification conditions | Reviewed August 18, 2026 |
| [Hack Hydra Luma page](https://luma.com/h038glzk) | Registration and event overview | Reviewed August 18, 2026 |
| [HydraDB open-source repository](https://github.com/hydra-db/hydradb) | Official runtime, HTTP API and graph engine behavior | Reviewed against the implementation |
| Hack Hydra Discord | Last-minute schedule or rule updates | **Not independently reviewed; check before submission** |
| Official submission form | Final field validation and upload destination | Link confirmed from the official page; final form completion pending |

When sources differ, the stricter requirement is treated as binding. No deadline extension is assumed unless HydraDB announces one officially.

## Mandatory requirements

| Requirement | Evidence in GenTether | Status |
|---|---|---|
| Choose one official track | README and submission target Track 02B | ✅ |
| Start participant-authored work on or after August 12, 2026 | Repository commits begin August 18, 2026 | ✅ |
| Team size of 1–4 and every member listed | Complete final team names/contributions in the form | ⏳ |
| HydraDB performs core work | `src/graph/hydra.ts`, `docs/HYDRA_QUERIES.md`, successful `Live HydraDB verification` workflow | ✅ |
| Functional product or demo | Web UI, HTTP API, MCP server, fixture and deterministic gate | ✅ |
| Public GitHub repository | Repository is currently private while being prepared | ❌ before submission |
| Complete source code in repository | Application, tests, Docker setup and Remotion source are present | ✅ |
| Clear README with setup/run instructions | `README.md` | ✅ |
| Required environment/dependency information | `.env.example`, `package.json`, README | ✅ |
| Explain how HydraDB is used and what is lost without it | README, architecture and exact queries | ✅ |
| Credit third-party code, libraries, APIs and datasets | README attribution section | ✅ |
| Open-source licence | `LICENSE` (MIT) | ✅ |
| Demo video no longer than three minutes | Remotion MP4 is 145.56 seconds (2:25.56) | ✅ |
| Video covers problem, build, working decisions and HydraDB use | Seven-scene Remotion composition and reviewed render | ✅ |
| Video viewable without requesting access | Upload rendered MP4 to YouTube as public or unlisted | ❌ |
| Official submission form completed | Project fields and final links still need submission | ❌ |
| Submit by deadline | Not yet submitted | ❌ |

## Track alignment

Track 02B asks builders to model code relationships in HydraDB and provide better context for IDE assistants than similarity retrieval alone.

GenTether's core decision depends on this typed graph:

```text
SourceSpec ──FEEDS──────> GeneratorCommand
GeneratorCommand ──GENERATES──> GeneratedArtifact
Consumer ──IMPORTS─────> GeneratedArtifact
Test ──IMPORTS─────────> Consumer
```

HydraDB starts from the generated artifact and performs a native incoming `IMPORTS` traversal with `maxLen: 4`. The graph answers a question a similarity index cannot prove: **is this the authoritative file the coding agent should edit, and what downstream code and tests are structurally connected to it?**

## Judging rubric evidence

| Criterion | Judge-facing evidence | Remaining gap |
|---|---|---|
| Technical execution | Green CI, scanner, deterministic gate, HTTP/MCP surfaces, tests and live HydraDB workflow | None in the repository |
| HydraDB and graph-native use | Typed ingestion, provenance joins and native incoming `algo.SSpaths` traversal | Keep the HydraDB evidence prominent in the form and video |
| Product completeness and usability | Polished web flow with three decisions and safe fallback labeling | Optional hosted demo would improve access but is not listed as mandatory |
| Quality of results | Deterministic fixture assertions plus live `BLOCK`, `REVIEW` and `ALLOW` verification | None in the repository |
| Originality | Generated-code provenance gate rather than another generic blast-radius map | Explain the "wrong edit target" wedge in the form |
| Best Use of HydraDB | Source-command-output chain plus directed downstream paths are the product's core evidence | Include the exact graph-loss explanation in the form |

## Required submission fields

Prepare these before opening the form:

| Field | Draft status |
|---|---|
| Project name | GenTether |
| Short description | Ready in README |
| Problem addressed | Ready in README |
| What was built | Ready in README |
| Deployed project link | Optional; not available yet |
| HydraDB OSS explanation | Ready in README and `docs/HYDRA_QUERIES.md` |
| Tech stack | Ready in README |
| Team members and individual contributions | Pending final names/contributions |
| Public GitHub URL | Pending visibility change |
| Demo video URL | Render complete; public/unlisted upload pending |

## Verified commands and artifacts

Application and repository gate:

```bash
npm install --no-audit --no-fund
npm test
npm run video:check
npm run audit
npm run demo
npm run build
npm start
```

Live HydraDB:

```bash
bash scripts/verify-hydra-live.sh
```

The live workflow uses the official `ghcr.io/hydra-db/hydradb` image and confirms ingestion, provenance resolution, native incoming path traversal, and all three gate outcomes.

Remotion:

```bash
npm run video:narration
npm run video:studio
npm run video:render
```

The reviewed MP4 is 1280×720, H.264/AAC, 145.56 seconds, and is produced as the `gentether-demo-video` GitHub Actions artifact.

## Hard submission gate

The codebase and demo artifact are verified, but the project is **not ready to submit yet**. These mandatory external steps remain:

- [ ] Upload the video to a judge-accessible public or unlisted URL
- [ ] Make the GitHub repository public
- [ ] Fill team-member and contribution fields
- [ ] Open every repository, video and optional demo link from a logged-out browser
- [ ] Complete and submit the official form before the deadline
- [ ] Check Discord once for last-minute updates or an official extension
