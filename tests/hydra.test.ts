import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { HydraClient } from "../src/graph/hydra.js";
import { scanRepository } from "../src/scanner.js";
import { GenTetherService } from "../src/service.js";
import type { ArtifactNode, RepositoryGraph } from "../src/types.js";

const fixture = path.resolve("fixtures/checkout-app");

test("Hydra adapter writes typed nodes and relationships then consumes bounded traversal rows", async () => {
  const snapshot = await scanRepository(fixture);
  const nodes = fixtureNodes(snapshot);
  const originalFetch = globalThis.fetch;
  const requests: Array<{ query: string; parameters: Record<string, unknown> }> = [];
  globalThis.fetch = mockHydraFetch(snapshot, requests);

  try {
    const hydra = testClient();
    await hydra.replaceGraph(snapshot);
    const evidence = await hydra.resolveLineage(nodes.generated);

    assert.ok(requests.some((request) => request.query.includes("UNWIND $rows AS row MERGE (n {id: row.id})")));
    assert.ok(requests.some((request) => request.query.includes("[r:GENERATES")));
    assert.ok(requests.some((request) => request.query.includes("[:IMPORTS*1..4]")));
    assert.ok(requests.some((request) => request.query.includes("[:FEEDS]")));
    assert.deepEqual(evidence.sourceIds, [nodes.source.id]);
    assert.deepEqual(evidence.commandIds, [nodes.command.id]);
    assert.deepEqual(evidence.generatedIds, [nodes.generated.id]);
    assert.deepEqual(evidence.declarationIds, [nodes.declaration.id]);
    assert.deepEqual(new Set(evidence.consumerIds), new Set([nodes.orders.id, nodes.checkout.id, nodes.test.id]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live gate is rebuilt from HydraDB evidence", async () => {
  const snapshot = await scanRepository(fixture);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockHydraFetch(snapshot, []);

  try {
    const service = await GenTetherService.create(fixture, { hydra: testClient() });
    const result = await service.checkPatch(["src/generated/api-client.ts"]);

    assert.equal(service.status().engine, "hydradb");
    assert.equal(result.engine, "hydradb");
    assert.equal(result.decision, "BLOCK");
    assert.deepEqual(result.authoritativeSources.map((node) => node.path), ["api/openapi.yaml"]);
    assert.deepEqual(result.commands.map((node) => node.metadata.run), ["npm run generate:api"]);
    assert.deepEqual(result.tests.map((node) => node.path), ["tests/checkout.test.ts"]);
    assert.ok(result.hydraQueries?.some((query) => query.includes("[:IMPORTS*1..4]")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing live provenance downgrades a local BLOCK to REVIEW", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ columns: [], rows: [] }), { status: 200 })) as typeof fetch;

  try {
    const service = await GenTetherService.create(fixture, { hydra: testClient() });
    const result = await service.checkPatch(["src/generated/api-client.ts"]);

    assert.equal(result.engine, "hydradb");
    assert.equal(result.decision, "REVIEW");
    assert.match(result.reasons.join(" "), /HydraDB did not return a complete source-command-output chain/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function testClient(): HydraClient {
  return new HydraClient({
    url: "http://hydra.test:8443",
    token: "test-token",
    namespace: "default",
    graph: "default",
    cellId: "cell-0",
  });
}

function mockHydraFetch(
  snapshot: RepositoryGraph,
  requests: Array<{ query: string; parameters: Record<string, unknown> }>,
): typeof fetch {
  const nodes = fixtureNodes(snapshot);
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      query: string;
      parameters: Record<string, unknown>;
    };
    requests.push(body);

    if (body.query.includes("RETURN s.id AS source_id")) {
      return jsonRows(
        ["source_id", "command_id", "generated_id"],
        [[nodes.source.id, nodes.command.id, nodes.generated.id]],
      );
    }
    if (body.query.includes("RETURN cfg.id AS declaration_id")) {
      return jsonRows(["declaration_id"], [[nodes.declaration.id]]);
    }
    if (body.query.includes("RETURN consumer.id AS consumer_id")) {
      return jsonRows(
        ["consumer_id"],
        [[nodes.orders.id], [nodes.checkout.id], [nodes.test.id]],
      );
    }
    return new Response(JSON.stringify({ columns: [], rows: [] }), { status: 200 });
  }) as typeof fetch;
}

function jsonRows(columns: string[], rows: number[][]): Response {
  return new Response(
    JSON.stringify({
      columns,
      rows: rows.map((row) => row.map((value) => ({ type: "integer", value }))),
    }),
    { status: 200 },
  );
}

function fixtureNodes(snapshot: RepositoryGraph): {
  source: ArtifactNode;
  command: ArtifactNode;
  generated: ArtifactNode;
  declaration: ArtifactNode;
  orders: ArtifactNode;
  checkout: ArtifactNode;
  test: ArtifactNode;
} {
  return {
    source: requiredNode(snapshot, "api/openapi.yaml"),
    command: requiredNode(snapshot, "package.json#script:generate:api"),
    generated: requiredNode(snapshot, "src/generated/api-client.ts"),
    declaration: requiredNode(snapshot, "package.json"),
    orders: requiredNode(snapshot, "src/services/orders.ts"),
    checkout: requiredNode(snapshot, "src/routes/checkout.ts"),
    test: requiredNode(snapshot, "tests/checkout.test.ts"),
  };
}

function requiredNode(snapshot: RepositoryGraph, nodePath: string): ArtifactNode {
  const node = snapshot.nodes.find((candidate) => candidate.path === nodePath);
  if (!node) throw new Error(`Expected fixture node ${nodePath}`);
  return node;
}
