import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { GenTetherService } from "../src/service.js";

const fixture = path.resolve("fixtures/checkout-app");

async function service(): Promise<GenTetherService> {
  return GenTetherService.create(fixture, { hydra: undefined });
}

test("blocks a direct generated artifact edit", async () => {
  const result = await (await service()).checkPatch(["src/generated/api-client.ts"]);
  assert.equal(result.decision, "BLOCK");
  assert.deepEqual(result.authoritativeSources.map((node) => node.path), ["api/openapi.yaml"]);
  assert.deepEqual(result.commands.map((node) => node.metadata.run), ["npm run generate:api"]);
  assert.ok(result.consumers.some((node) => node.path === "src/routes/checkout.ts"));
  assert.ok(result.tests.some((node) => node.path === "tests/checkout.test.ts"));
});

test("reviews a source change with a missing generated output", async () => {
  const result = await (await service()).checkPatch(["api/openapi.yaml"]);
  assert.equal(result.decision, "REVIEW");
  assert.deepEqual(result.staleOutputs.map((node) => node.path), ["src/generated/api-client.ts"]);
});

test("allows a coordinated source and generated-output patch", async () => {
  const result = await (await service()).checkPatch([
    "api/openapi.yaml",
    "src/generated/api-client.ts",
  ]);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.staleOutputs.length, 0);
});

test("returns an exact multi-hop consumer and test chain", async () => {
  const result = await (await service()).lineage("src/generated/api-client.ts");
  if (!result) throw new Error("Expected lineage result");
  assert.deepEqual(result.sources.map((node) => node.path), ["api/openapi.yaml"]);
  assert.deepEqual(result.consumers.map((node) => node.path), [
    "src/services/orders.ts",
    "src/routes/checkout.ts",
  ]);
  assert.deepEqual(result.tests.map((node) => node.path), ["tests/checkout.test.ts"]);
  const testPath = result.paths.find((candidate) => candidate.nodes[0]?.path === "tests/checkout.test.ts");
  if (!testPath) throw new Error("Expected test evidence path");
  assert.deepEqual(testPath.edges.map((edge) => edge.type), ["IMPORTS", "IMPORTS", "IMPORTS"]);
});
