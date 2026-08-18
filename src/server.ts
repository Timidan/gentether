import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GenTetherService } from "./service.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot =
  path.basename(path.dirname(moduleDirectory)) === "dist"
    ? path.resolve(moduleDirectory, "../..")
    : path.resolve(moduleDirectory, "..");
const repositoryRoot = path.resolve(process.env.GENTETHER_REPO ?? path.join(projectRoot, "fixtures/checkout-app"));
const publicDirectory = path.join(projectRoot, "public");
const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const service = await GenTetherService.create(repositoryRoot);

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if (method === "GET" && url.pathname === "/api/status") return json(response, 200, service.status());
    if (method === "GET" && url.pathname === "/api/generated") {
      return json(response, 200, { files: service.generatedFiles() });
    }
    if (method === "GET" && url.pathname === "/api/lineage") {
      const file = url.searchParams.get("file")?.trim();
      if (!file) return json(response, 400, { error: "Query parameter 'file' is required." });
      const result = await service.lineage(file);
      return result
        ? json(response, 200, result)
        : json(response, 404, { error: "File is not present in the active graph." });
    }
    if (method === "POST" && url.pathname === "/api/analyze") {
      const body = await readJsonBody(request);
      if (!isStringArray(body.changedFiles) || body.changedFiles.length > 200) {
        return json(response, 400, { error: "changedFiles must be an array of at most 200 file paths." });
      }
      return json(response, 200, await service.checkPatch(body.changedFiles));
    }
    if (method === "POST" && url.pathname === "/api/reindex") {
      return json(response, 200, await service.reindex());
    }
    if (method === "GET" && url.pathname === "/api/demo") {
      return json(response, 200, {
        blocked: await service.checkPatch(["src/generated/api-client.ts"]),
        review: await service.checkPatch(["api/openapi.yaml"]),
        allowed: await service.checkPatch(["api/openapi.yaml", "src/generated/api-client.ts"]),
      });
    }

    if (method !== "GET" && method !== "HEAD") return json(response, 405, { error: "Method not allowed." });
    return serveStatic(response, url.pathname, method === "HEAD");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(response, 500, { error: message });
  }
});

server.listen(port, "127.0.0.1", () => {
  const status = service.status();
  console.log(`GenTether listening on http://127.0.0.1:${port}`);
  console.log(`Indexed ${status.root} with ${status.engine}.`);
});

async function readJsonBody(request: any): Promise<Record<string, unknown>> {
  const chunks: string[] = [];
  let size = 0;
  for await (const chunk of request) {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    size += text.length;
    if (size > 131_072) throw new Error("Request body exceeds 128 KB.");
    chunks.push(text);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(chunks.join("")) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("JSON body must be an object.");
  }
  return parsed as Record<string, unknown>;
}

async function serveStatic(response: any, pathname: string, headOnly: boolean): Promise<void> {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safePath = path.resolve(publicDirectory, requested);
  if (!safePath.startsWith(`${path.resolve(publicDirectory)}${path.sep}`) && safePath !== path.join(publicDirectory, "index.html")) {
    return json(response, 403, { error: "Forbidden." });
  }
  let finalPath = safePath;
  try {
    const stat = await fs.stat(finalPath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    finalPath = path.join(publicDirectory, "index.html");
  }
  const body = await fs.readFile(finalPath);
  response.writeHead(200, {
    "Content-Type": mimeType(finalPath),
    "Content-Length": body.length,
    "Cache-Control": finalPath.endsWith("index.html") ? "no-cache" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(headOnly ? undefined : body);
}

function json(response: any, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function mimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };
  return types[extension] ?? "application/octet-stream";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
}
