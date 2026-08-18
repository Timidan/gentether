import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { scanRepository } from "../src/scanner.js";

const fixture = path.resolve("fixtures/checkout-app");

test("scanner builds the generated-code provenance graph", async () => {
  const graph = await scanRepository(fixture);
  assert.equal(graph.stats.files, 8);
  assert.equal(graph.stats.generatedFiles, 1);
  assert.equal(graph.stats.sourceSpecs, 1);
  assert.equal(graph.stats.commands, 1);
  assert.deepEqual(graph.warnings, []);

  const source = graph.nodes.find((node) => node.path === "api/openapi.yaml");
  const command = graph.nodes.find((node) => node.path === "package.json#script:generate:api");
  const output = graph.nodes.find((node) => node.path === "src/generated/api-client.ts");
  if (!source || !command || !output) throw new Error("Expected source, command and output nodes");
  assert.ok(graph.edges.some((edge) => edge.type === "FEEDS" && edge.from === source.id && edge.to === command.id));
  assert.ok(graph.edges.some((edge) => edge.type === "GENERATES" && edge.from === command.id && edge.to === output.id));
});

test("scanner does not mark a generator script from a generated string literal", async () => {
  const graph = await scanRepository(fixture);
  const generatorScript = graph.nodes.find((node) => node.path === "tools/generate-client.mjs");
  if (!generatorScript) throw new Error("Expected generator script node");
  assert.equal(generatorScript.kind, "file");
});
