import path from "node:path";

import { GenTetherService } from "../src/service.js";

const fixture = path.resolve("fixtures/checkout-app");
const service = await GenTetherService.create(fixture);
const scenarios = [
  { label: "Generated file only", files: ["src/generated/api-client.ts"] },
  { label: "Source only", files: ["api/openapi.yaml"] },
  { label: "Source and regenerated output", files: ["api/openapi.yaml", "src/generated/api-client.ts"] },
];

console.log("\nGenTether — Edit the source. Never the artifact.\n");
console.log(`Engine: ${service.status().engine}`);
console.log(`Graph: ${service.status().stats.files} files · ${service.status().stats.relationships} relationships\n`);

for (const scenario of scenarios) {
  const result = await service.checkPatch(scenario.files);
  console.log(`=== ${scenario.label} ===`);
  console.log(result.contextPack);
}
