# GenTether Demo Script

Target: **2 minutes 25 seconds**. Keep the HydraDB status pill visible.

## 0:00–0:18 · Hook

**Screen:** Landing page hero.

> “Generated code looks editable. That is why coding agents keep making changes that disappear the next time the project regenerates its client or types. GenTether makes the repository tell the agent where the real edit belongs.”

## 0:18–0:40 · What was indexed

**Screen:** Metrics and status pill.

> “This demo repository has an OpenAPI schema, a generation command, one generated TypeScript client, two downstream consumers and a test. GenTether stores those as typed relationships. When HydraDB is connected, the status says HydraDB live; it never hides the local fallback.”

## 0:40–1:08 · Block the wrong edit

**Screen:** Select **Generated only** and click **Analyze proposed patch**.

> “First, the agent proposes changing only the generated API client. GenTether blocks it. The decision is not based on a filename guess alone. The graph traces the client back to `api/openapi.yaml` and the exact `npm run generate:api` command.”

Point to consumers and test in the returned reasons/context.

## 1:08–1:30 · Catch a stale source change

**Screen:** Select **Source only**.

> “Now the agent edits the correct OpenAPI schema, but forgets to include the regenerated client. That is not safe yet, so GenTether returns review and names the stale output that is missing.”

## 1:30–1:48 · Allow the coordinated patch

**Screen:** Select **Source + output**.

> “When the source and connected generated output change together, GenTether allows the patch and returns the generator and verification plan.”

## 1:48–2:13 · Show the graph evidence

**Screen:** Click **Trace the demo graph**.

> “Here is the chain of custody: the OpenAPI source feeds the command, the command generates the client, the service imports it, the route imports the service, and the test reaches that route. HydraDB performs the typed provenance and bounded import traversal.”

## 2:13–2:25 · Close

**Screen:** MCP tools section.

> “The same decision is available to coding agents through MCP before they write a file. GenTether: edit the source, never the artifact.”
