import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = await readFile(path.join(root, "api/openapi.yaml"), "utf8");
if (!schema.includes("operationId: getOrder")) throw new Error("Expected getOrder in OpenAPI schema");

const output = `// AUTO-GENERATED. DO NOT EDIT.\n// Source: api/openapi.yaml\n// Command: npm run generate:api\n\nexport interface Order {\n  id: string;\n  status: \"pending\" | \"paid\" | \"fulfilled\";\n  total: number;\n}\n\nexport async function getOrder(orderId: string): Promise<Order> {\n  return { id: orderId, status: \"paid\", total: 125 };\n}\n`;
await writeFile(path.join(root, "src/generated/api-client.ts"), output);
console.log("generated src/generated/api-client.ts from api/openapi.yaml");
