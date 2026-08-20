const baseInput = process.argv[2] ?? process.env.DEPLOYMENT_URL;
if (!baseInput) {
  console.error("Usage: node scripts/check-deployment.mjs BASE_URL (or set DEPLOYMENT_URL)");
  process.exit(2);
}

const baseUrl = new URL(baseInput);
if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
  throw new Error("Deployment URL must use HTTP or HTTPS.");
}

const secretValues = [process.env.HYDRA_TOKEN, process.env.CLOUDFLARE_TUNNEL_TOKEN].filter(
  (value) => typeof value === "string" && value.length >= 8,
);
const responses = [];

const home = await request("/");
assert(home.text.includes("GenTether"), "/ must contain GenTether");

const status = await requestJson("/api/status");
assert(status.value.engine === "hydradb", "/api/status must report engine=hydradb");
assert(status.value.hydraConnected === true, "/api/status must report hydraConnected=true");

const demo = await requestJson("/api/demo");
assert(demo.value.blocked?.decision === "BLOCK", "demo blocked scenario must return BLOCK");
assert(demo.value.review?.decision === "REVIEW", "demo review scenario must return REVIEW");
assert(demo.value.allowed?.decision === "ALLOW", "demo allowed scenario must return ALLOW");

const lineage = await requestJson("/api/lineage?file=src%2Fgenerated%2Fapi-client.ts");
assert(nonEmpty(lineage.value.sources), "lineage must include a source");
assert(nonEmpty(lineage.value.commands), "lineage must include a generator command");
assert(
  nonEmpty(lineage.value.generatedOutputs) &&
    lineage.value.generatedOutputs.some((node) => node?.path === "src/generated/api-client.ts"),
  "lineage must include the generated output",
);
assert(nonEmpty(lineage.value.consumers), "lineage must include a consumer");
assert(nonEmpty(lineage.value.tests), "lineage must include a test");
assert(lineage.value.engine === "hydradb", "lineage must report engine=hydradb");

for (const response of responses) {
  for (const secret of secretValues) {
    assert(!response.text.includes(secret), `${response.path} exposed a configured deployment secret`);
  }
}

console.log(
  JSON.stringify(
    {
      verdict: "deployment-check-passed",
      baseUrl: baseUrl.toString(),
      engine: status.value.engine,
      hydraConnected: status.value.hydraConnected,
      decisions: {
        blocked: demo.value.blocked.decision,
        review: demo.value.review.decision,
        allowed: demo.value.allowed.decision,
      },
      lineage: {
        sources: lineage.value.sources.length,
        commands: lineage.value.commands.length,
        generatedOutputs: lineage.value.generatedOutputs.length,
        consumers: lineage.value.consumers.length,
        tests: lineage.value.tests.length,
      },
    },
    null,
    2,
  ),
);

async function request(pathname) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();
  responses.push({ path: pathname, text });
  assert(response.ok, `${pathname} returned HTTP ${response.status}`);
  return { response, text };
}

async function requestJson(pathname) {
  const result = await request(pathname);
  let value;
  try {
    value = JSON.parse(result.text);
  } catch {
    throw new Error(`${pathname} did not return valid JSON`);
  }
  return { ...result, value };
}

function nonEmpty(value) {
  return Array.isArray(value) && value.length > 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
