import path from "node:path";
import { fileURLToPath } from "node:url";

import { GenTetherService } from "./service.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot =
  path.basename(path.dirname(moduleDirectory)) === "dist"
    ? path.resolve(moduleDirectory, "../..")
    : path.resolve(moduleDirectory, "..");
const repositoryRoot = path.resolve(process.env.GENTETHER_REPO ?? path.join(projectRoot, "fixtures/checkout-app"));
const service = await GenTetherService.create(repositoryRoot);

const tools = [
  {
    name: "gentether_resolve_edit_target",
    description:
      "Resolve a file to its authoritative source, generator command, generated outputs, consumers and tests before editing.",
    inputSchema: {
      type: "object",
      properties: { file: { type: "string", minLength: 1 } },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "gentether_check_patch",
    description: "Gate a proposed patch. Blocks direct generated-file edits and identifies missing regenerated outputs.",
    inputSchema: {
      type: "object",
      properties: {
        changedFiles: { type: "array", minItems: 1, maxItems: 200, items: { type: "string", minLength: 1 } },
      },
      required: ["changedFiles"],
      additionalProperties: false,
    },
  },
  {
    name: "gentether_plan_regeneration",
    description:
      "Return the regeneration command, output files, downstream consumers and tests for a source specification or generated artifact.",
    inputSchema: {
      type: "object",
      properties: { file: { type: "string", minLength: 1 } },
      required: ["file"],
      additionalProperties: false,
    },
  },
];

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  void drainBuffer();
});

async function drainBuffer(): Promise<void> {
  while (buffer.length > 0) {
    if (buffer.startsWith("Content-Length:")) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match?.[1]) {
        buffer = "";
        return;
      }
      const length = Number.parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      const body = buffer.slice(bodyStart, bodyStart + length);
      buffer = buffer.slice(bodyStart + length);
      await receive(body);
      continue;
    }

    const newline = buffer.indexOf("\n");
    if (newline < 0) return;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) await receive(line);
  }
}

async function receive(raw: string): Promise<void> {
  let request: JsonRpcRequest;
  try {
    request = JSON.parse(raw) as JsonRpcRequest;
  } catch {
    return sendError(undefined, -32700, "Parse error");
  }

  try {
    if (request.method === "notifications/initialized") return;
    if (request.method === "initialize") {
      return sendResult(request.id, {
        protocolVersion: String(request.params?.protocolVersion ?? "2025-06-18"),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "gentether", version: "0.1.0" },
        instructions: "Call gentether_check_patch before writing files and obey BLOCK decisions.",
      });
    }
    if (request.method === "ping") return sendResult(request.id, {});
    if (request.method === "tools/list") return sendResult(request.id, { tools });
    if (request.method === "tools/call") {
      const name = request.params?.name;
      const argumentsValue = request.params?.arguments;
      if (typeof name !== "string" || !isRecord(argumentsValue)) {
        return sendError(request.id, -32602, "tools/call requires a tool name and object arguments");
      }
      return sendResult(request.id, await callTool(name, argumentsValue));
    }
    return sendError(request.id, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    return sendError(request.id, -32603, error instanceof Error ? error.message : String(error));
  }
}

async function callTool(name: string, argumentsValue: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (name === "gentether_resolve_edit_target") {
    const file = requiredString(argumentsValue.file, "file");
    const result = await service.lineage(file);
    return result
      ? { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result }
      : { content: [{ type: "text", text: `No indexed artifact matched ${file}` }], isError: true };
  }

  if (name === "gentether_check_patch") {
    const changedFiles = requiredStringArray(argumentsValue.changedFiles, "changedFiles");
    const result = await service.checkPatch(changedFiles);
    return {
      content: [{ type: "text", text: result.contextPack }],
      structuredContent: result,
      isError: result.decision === "BLOCK",
    };
  }

  if (name === "gentether_plan_regeneration") {
    const file = requiredString(argumentsValue.file, "file");
    const result = await service.lineage(file);
    if (!result) return { content: [{ type: "text", text: `No indexed artifact matched ${file}` }], isError: true };
    const plan = {
      source: result.sources.map((node) => node.path),
      commands: result.commands.map((node) => node.metadata.run ?? node.name),
      outputs: result.generatedOutputs.map((node) => node.path),
      consumers: result.consumers.map((node) => node.path),
      tests: result.tests.map((node) => node.path),
      engine: result.engine,
    };
    return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }], structuredContent: plan };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function sendResult(id: JsonRpcRequest["id"], result: unknown): void {
  if (id === undefined) return;
  writeMessage({ jsonrpc: "2.0", id, result });
}

function sendError(id: JsonRpcRequest["id"], code: number, message: string): void {
  writeMessage({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function writeMessage(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200 || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error(`${field} must be an array of 1 to 200 non-empty strings`);
  }
  return value as string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
