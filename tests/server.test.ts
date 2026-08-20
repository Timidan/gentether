import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";

const fixture = path.resolve("fixtures/checkout-app");

test("health endpoints report an optional memory-mode server as usable", { timeout: 10_000 }, async () => {
  const port = await availablePort();
  const child = spawn(process.execPath, ["dist/src/server.js"], {
    env: {
      ...process.env,
      GENTETHER_REPO: fixture,
      HOST: "127.0.0.1",
      PORT: String(port),
      REQUIRE_HYDRA: "false",
      HYDRA_URL: "",
      HYDRA_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let diagnostics = "";
  child.stdout.on("data", (chunk: any) => {
    diagnostics += chunk.toString();
  });
  child.stderr.on("data", (chunk: any) => {
    diagnostics += chunk.toString();
  });

  try {
    const health = await waitForResponse(`http://127.0.0.1:${port}/healthz`, child);
    assert.equal(health.status, 200, diagnostics);
    assert.deepEqual(await health.json(), { status: "ok" });

    const readiness = await fetch(`http://127.0.0.1:${port}/readyz`);
    assert.equal(readiness.status, 200, diagnostics);
    assert.deepEqual(await readiness.json(), {
      status: "ready",
      engine: "memory",
      hydraConnected: false,
    });
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", () => resolve());
    });
  }
});

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error: any) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForResponse(url: string, child: ReturnType<typeof spawn>): Promise<Response> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`GenTether exited with ${child.exitCode}`);
    try {
      return await fetch(url);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("GenTether did not start listening");
}
