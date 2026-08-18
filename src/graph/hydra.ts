import type { ArtifactEdge, ArtifactNode, RelationType, RepositoryGraph } from "../types.js";

const RELATION_TYPES: RelationType[] = [
  "CONTAINS",
  "DECLARES",
  "FEEDS",
  "GENERATES",
  "IMPORTS",
  "VERIFIES",
];

export interface HydraConfig {
  url: string;
  token: string;
  namespace: string;
  graph: string;
  cellId: string;
}

export interface HydraQueryRecord {
  query: string;
  response: unknown;
}

export interface HydraLineageEvidence {
  sourceIds: number[];
  commandIds: number[];
  generatedIds: number[];
  declarationIds: number[];
  consumerIds: number[];
  records: HydraQueryRecord[];
}

export class HydraClient {
  readonly config: HydraConfig;

  constructor(config: HydraConfig) {
    this.config = config;
  }

  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): HydraClient | undefined {
    const url = environment.HYDRA_URL?.replace(/\/$/, "");
    const token = environment.HYDRA_TOKEN;
    if (!url || !token) return undefined;
    return new HydraClient({
      url,
      token,
      namespace: environment.HYDRA_NAMESPACE ?? "default",
      graph: environment.HYDRA_GRAPH ?? "default",
      cellId: environment.HYDRA_CELL_ID ?? "cell-0",
    });
  }

  async query(query: string, parameters: Record<string, unknown> = {}): Promise<unknown> {
    const endpoint = `${this.config.url}/v1/graphs/${encodeURIComponent(this.config.graph)}/query`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          "X-Graph-Namespace": this.config.namespace,
          Accept: "application/json",
        },
        body: JSON.stringify({ cell_id: this.config.cellId, query, parameters }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HydraDB ${response.status}: ${text.slice(0, 600)}`);
      }
      return parseHydraBody(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  async replaceGraph(snapshot: RepositoryGraph): Promise<void> {
    await this.query(
      "MATCH (n:GenTetherArtifact) WHERE n.repository_id = $repositoryId DETACH DELETE n",
      { repositoryId: snapshot.repositoryId },
    );

    for (const rows of chunks(snapshot.nodes.map((node) => nodeRow(snapshot, node)), 250)) {
      await this.query(
        [
          "UNWIND $rows AS row",
          "MERGE (n {id: row.id})",
          "SET n:GenTetherArtifact, n.repository_id = row.repository_id, n.artifact_key = row.artifact_key,",
          "n.kind = row.kind, n.name = row.name, n.path = row.path",
        ].join(" "),
        { rows },
      );
    }

    for (const relation of RELATION_TYPES) {
      const matching = snapshot.edges.filter((edge) => edge.type === relation);
      for (const rows of chunks(matching.map(edgeRow), 250)) {
        await this.query(edgeInsertQuery(relation), { rows });
      }
    }

    await this.query(
      "MATCH (n:GenTetherArtifact) WHERE n.repository_id = $repositoryId RETURN count(*) AS total",
      { repositoryId: snapshot.repositoryId },
    );
  }

  /**
   * Resolve the source-command-output chain and downstream consumers from
   * HydraDB's returned rows. These IDs are used by the live gate, rather than
   * merely treating a successful query as a connectivity check.
   */
  async resolveLineage(target: ArtifactNode): Promise<HydraLineageEvidence> {
    const records: HydraQueryRecord[] = [];
    const lineageQuery = lineageQueryFor(target);
    const lineageResponse = await this.query(lineageQuery, { target: target.id });
    records.push({ query: lineageQuery, response: lineageResponse });

    const lineageRows = responseRows(lineageResponse);
    const sourceIds = numberColumn(lineageRows, "source_id");
    const commandIds = numberColumn(lineageRows, "command_id");
    const generatedIds = numberColumn(lineageRows, "generated_id");
    const declarationIds: number[] = [];
    const consumerIds: number[] = [];

    for (const commandId of commandIds) {
      const declarationQuery =
        "MATCH (cfg:GenTetherArtifact)-[:DECLARES]->(c:GenTetherArtifact) WHERE c.id = $command RETURN cfg.id AS declaration_id LIMIT 100";
      const response = await this.query(declarationQuery, { command: commandId });
      records.push({ query: declarationQuery, response });
      declarationIds.push(...numberColumn(responseRows(response), "declaration_id"));
    }

    for (const generatedId of generatedIds) {
      const consumerQuery =
        "MATCH (consumer:GenTetherArtifact)-[:IMPORTS*1..4]->(g:GenTetherArtifact) WHERE g.id = $target RETURN consumer.id AS consumer_id LIMIT 200";
      const response = await this.query(consumerQuery, { target: generatedId });
      records.push({ query: consumerQuery, response });
      consumerIds.push(...numberColumn(responseRows(response), "consumer_id"));
    }

    return {
      sourceIds: uniqueNumbers(sourceIds),
      commandIds: uniqueNumbers(commandIds),
      generatedIds: uniqueNumbers(generatedIds),
      declarationIds: uniqueNumbers(declarationIds),
      consumerIds: uniqueNumbers(consumerIds),
      records,
    };
  }

  /** @deprecated Use resolveLineage so callers consume HydraDB result rows. */
  async verifyLineage(target: ArtifactNode): Promise<HydraQueryRecord[]> {
    return (await this.resolveLineage(target)).records;
  }
}

function lineageQueryFor(target: ArtifactNode): string {
  if (target.kind === "source_spec") {
    return "MATCH (s:GenTetherArtifact)-[:FEEDS]->(c:GenTetherArtifact), (c)-[:GENERATES]->(g:GenTetherArtifact) WHERE s.id = $target RETURN s.id AS source_id, c.id AS command_id, g.id AS generated_id LIMIT 100";
  }
  if (target.kind === "generator_command") {
    return "MATCH (s:GenTetherArtifact)-[:FEEDS]->(c:GenTetherArtifact), (c)-[:GENERATES]->(g:GenTetherArtifact) WHERE c.id = $target RETURN s.id AS source_id, c.id AS command_id, g.id AS generated_id LIMIT 100";
  }
  if (target.kind === "generator_config") {
    return "MATCH (cfg:GenTetherArtifact)-[:DECLARES]->(c:GenTetherArtifact), (s:GenTetherArtifact)-[:FEEDS]->(c), (c)-[:GENERATES]->(g:GenTetherArtifact) WHERE cfg.id = $target RETURN s.id AS source_id, c.id AS command_id, g.id AS generated_id LIMIT 100";
  }
  if (target.kind === "generated_file") {
    return "MATCH (s:GenTetherArtifact)-[:FEEDS]->(c:GenTetherArtifact), (c)-[:GENERATES]->(g:GenTetherArtifact) WHERE g.id = $target RETURN s.id AS source_id, c.id AS command_id, g.id AS generated_id LIMIT 100";
  }
  return "MATCH (selected:GenTetherArtifact)-[:IMPORTS*1..4]->(g:GenTetherArtifact), (s:GenTetherArtifact)-[:FEEDS]->(c:GenTetherArtifact), (c)-[:GENERATES]->(g) WHERE selected.id = $target RETURN s.id AS source_id, c.id AS command_id, g.id AS generated_id LIMIT 100";
}

function nodeRow(snapshot: RepositoryGraph, node: ArtifactNode): Record<string, unknown> {
  return {
    id: node.id,
    repository_id: snapshot.repositoryId,
    artifact_key: node.key,
    kind: node.kind,
    name: node.name,
    path: node.path,
  };
}

function edgeRow(edge: ArtifactEdge): Record<string, unknown> {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    evidence: edge.evidence,
    confidence: edge.confidence,
  };
}

function edgeInsertQuery(relation: RelationType): string {
  // The relationship type is selected from a closed enum above, never from user input.
  return [
    "UNWIND $rows AS row",
    "MATCH (s:GenTetherArtifact {id: row.from}), (d:GenTetherArtifact {id: row.to})",
    `MERGE (s)-[r:${relation} {id: row.id}]->(d)`,
    "SET r.evidence = row.evidence, r.confidence = row.confidence",
  ].join(" ");
}

function responseRows(response: unknown): Record<string, unknown>[] {
  const bodies = Array.isArray(response) ? response : [response];
  const output: Record<string, unknown>[] = [];

  for (const body of bodies) {
    if (!isRecord(body) || !Array.isArray(body.columns) || !Array.isArray(body.rows)) continue;
    const columns = body.columns.filter((column): column is string => typeof column === "string");
    for (const row of body.rows) {
      if (!Array.isArray(row)) continue;
      const record: Record<string, unknown> = {};
      for (let index = 0; index < columns.length; index += 1) {
        record[columns[index] ?? String(index)] = decodeHydraValue(row[index]);
      }
      output.push(record);
    }
  }
  return output;
}

function decodeHydraValue(value: unknown): unknown {
  if (!isRecord(value) || typeof value.type !== "string") return value;
  if (value.type === "null") return null;
  return value.value;
}

function numberColumn(rows: Record<string, unknown>[], column: string): number[] {
  return rows
    .map((row) => row[column])
    .filter((value): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function parseHydraBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return line;
        }
      });
  }
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
