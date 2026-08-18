import assert from "node:assert/strict";
import path from "node:path";

import { HydraClient } from "../src/graph/hydra.js";
import { GenTetherService } from "../src/service.js";

const fixture = path.resolve("fixtures/checkout-app");
const hydra = HydraClient.fromEnvironment();

if (!hydra) {
  throw new Error("HYDRA_URL and HYDRA_TOKEN are required for the live HydraDB verification.");
}

const service = await GenTetherService.create(fixture, { hydra });
const status = service.status();

if (status.engine !== "hydradb" || !status.hydraConnected) {
  console.error("HydraDB live verification fell back to memory:");
  console.error(JSON.stringify(status, null, 2));
  throw new Error("HydraDB ingestion did not complete; inspect the fallback warning above.");
}

const generatedPath = "src/generated/api-client.ts";
const lineage = await service.lineage(generatedPath);
if (!lineage) throw new Error(`Expected lineage for ${generatedPath}`);
assert.equal(lineage.engine, "hydradb");
assert.ok(lineage.hydraQueries && lineage.hydraQueries.length >= 2, "Expected recorded HydraDB traversal queries");
assert.deepEqual(lineage.sources.map((node) => node.path), ["api/openapi.yaml"]);
assert.deepEqual(lineage.commands.map((node) => node.path), ["package.json#script:generate:api"]);
assert.deepEqual(lineage.generatedOutputs.map((node) => node.path), [generatedPath]);
assert.deepEqual(
  lineage.consumers.map((node) => node.path).sort(),
  ["src/routes/checkout.ts", "src/services/orders.ts"],
);
assert.deepEqual(lineage.tests.map((node) => node.path), ["tests/checkout.test.ts"]);

const scenarios = [
  { files: [generatedPath], expected: "BLOCK" },
  { files: ["api/openapi.yaml"], expected: "REVIEW" },
  { files: ["api/openapi.yaml", generatedPath], expected: "ALLOW" },
] as const;

for (const scenario of scenarios) {
  const result = await service.checkPatch([...scenario.files]);
  assert.equal(result.engine, "hydradb", `Expected HydraDB evidence for ${scenario.files.join(", ")}`);
  assert.equal(result.decision, scenario.expected);
  assert.ok(result.hydraQueries && result.hydraQueries.length > 0, "Expected HydraDB queries in the gate result");
}

console.log(
  JSON.stringify(
    {
      result: "hydradb-live-verification-ok",
      engine: status.engine,
      graph: status.stats,
      lineage: {
        source: lineage.sources.map((node) => node.path),
        command: lineage.commands.map((node) => node.path),
        output: lineage.generatedOutputs.map((node) => node.path),
        consumers: lineage.consumers.map((node) => node.path),
        tests: lineage.tests.map((node) => node.path),
      },
      decisions: scenarios.map((scenario) => ({ files: scenario.files, decision: scenario.expected })),
    },
    null,
    2,
  ),
);
