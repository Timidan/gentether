import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { HydraClient } from "../src/graph/hydra.js";
import { GenTetherService } from "../src/service.js";
import type { RepositoryGraph } from "../src/types.js";

const fixture = path.resolve("fixtures/checkout-app");

test("startup recovers when HydraDB becomes available within the retry window", async () => {
  const hydra = new StartupHydraClient(1);

  const service = await GenTetherService.create(fixture, {
    hydra,
    hydraStartup: { attempts: 2, delayMs: 0 },
  });

  assert.equal(service.status().engine, "hydradb");
  assert.equal(service.status().hydraConnected, true);
});

test("startup preserves the memory fallback when optional HydraDB never becomes ready", async () => {
  const hydra = new StartupHydraClient(Number.POSITIVE_INFINITY);

  const service = await GenTetherService.create(fixture, {
    hydra,
    hydraStartup: { attempts: 2, delayMs: 0 },
  });

  assert.equal(service.status().engine, "memory");
  assert.equal(service.status().hydraConnected, false);
  assert.match(service.status().warnings.at(-1)?.message ?? "", /HydraDB fallback: HydraDB is still starting/);
});

test("startup fails closed when required HydraDB never becomes ready", async () => {
  const hydra = new StartupHydraClient(Number.POSITIVE_INFINITY);

  await assert.rejects(
    GenTetherService.create(fixture, {
      hydra,
      hydraStartup: { attempts: 2, delayMs: 0, requireHydra: true },
    }),
    /HydraDB is required but synchronization failed after 2 attempts: HydraDB is still starting/,
  );
});

class StartupHydraClient extends HydraClient {
  private attempts = 0;

  constructor(private readonly failuresBeforeSuccess: number) {
    super({
      url: "http://hydra.test:8443",
      token: "test-token",
      namespace: "default",
      graph: "default",
      cellId: "cell-0",
    });
  }

  override async replaceGraph(_snapshot: RepositoryGraph): Promise<void> {
    this.attempts += 1;
    if (this.attempts <= this.failuresBeforeSuccess) throw new Error("HydraDB is still starting");
  }
}
