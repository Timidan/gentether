import path from "node:path";

import { buildVerificationCommands, checkPatch, renderContextPack } from "./gate.js";
import { HydraClient, type HydraLineageEvidence } from "./graph/hydra.js";
import { MemoryGraph } from "./graph/memory.js";
import { scanRepository, type ScanOptions } from "./scanner.js";
import type {
  ArtifactNode,
  GateDecision,
  GraphStatus,
  LineageResult,
  PatchGateResult,
  RepositoryGraph,
} from "./types.js";
import { normalizeRepoPath, severity, uniqueBy } from "./utils.js";

export interface HydraStartupOptions {
  attempts?: number;
  delayMs?: number;
  requireHydra?: boolean;
}

export class GenTetherService {
  private snapshotValue: RepositoryGraph;
  private memoryGraphValue: MemoryGraph;
  private hydraConnectedValue = false;
  private hydraError: string | undefined;

  private constructor(
    snapshot: RepositoryGraph,
    private readonly hydra?: HydraClient,
  ) {
    this.snapshotValue = snapshot;
    this.memoryGraphValue = new MemoryGraph(snapshot);
  }

  static async create(
    rootInput: string,
    options: { scan?: ScanOptions; hydra?: HydraClient | undefined; hydraStartup?: HydraStartupOptions } = {},
  ): Promise<GenTetherService> {
    const root = path.resolve(rootInput);
    const snapshot = await scanRepository(root, options.scan);
    const hydra = options.hydra ?? HydraClient.fromEnvironment();
    const service = new GenTetherService(snapshot, hydra);
    await service.syncHydra(options.hydraStartup?.attempts, options.hydraStartup?.delayMs);
    if (options.hydraStartup?.requireHydra && !service.hydraConnectedValue) {
      const attempts = Math.max(1, Math.trunc(options.hydraStartup.attempts ?? 1));
      const detail = service.hydraError ?? "HydraDB is not configured";
      throw new Error(`HydraDB is required but synchronization failed after ${attempts} attempts: ${detail}`);
    }
    return service;
  }

  get snapshot(): RepositoryGraph {
    return this.snapshotValue;
  }

  get memoryGraph(): MemoryGraph {
    return this.memoryGraphValue;
  }

  async reindex(): Promise<GraphStatus> {
    this.snapshotValue = await scanRepository(this.snapshotValue.root);
    this.memoryGraphValue = new MemoryGraph(this.snapshotValue);
    await this.syncHydra();
    return this.status();
  }

  status(): GraphStatus {
    const warnings = [...this.snapshotValue.warnings];
    if (this.hydraError) warnings.push({ message: `HydraDB fallback: ${this.hydraError}` });
    return {
      repositoryId: this.snapshotValue.repositoryId,
      root: this.snapshotValue.root,
      engine: this.hydraConnectedValue ? "hydradb" : "memory",
      hydraConnected: this.hydraConnectedValue,
      stats: this.snapshotValue.stats,
      warnings,
    };
  }

  generatedFiles(): string[] {
    return this.snapshotValue.nodes
      .filter((node) => node.kind === "generated_file")
      .map((node) => node.path)
      .sort();
  }

  async lineage(filePathInput: string): Promise<LineageResult | undefined> {
    const filePath = normalizeRepoPath(filePathInput);
    const fallback = this.memoryGraphValue.lineage(filePath);
    if (!fallback || !this.hydra || !this.hydraConnectedValue) return fallback;

    try {
      const evidence = await this.hydra.resolveLineage(fallback.target);
      const sources = this.nodesFor(evidence.sourceIds);
      const commands = this.nodesFor(evidence.commandIds);
      const generatedOutputs = this.nodesFor(evidence.generatedIds);
      const downstream = this.nodesFor(evidence.consumerIds);
      const tests = downstream.filter((node) => node.kind === "test");
      const consumers = downstream.filter(
        (node) => node.kind !== "test" && node.kind !== "generated_file" && node.kind !== "generator_command",
      );
      const warnings = [...fallback.warnings];

      if (isGenerationTarget(fallback.target) && (sources.length === 0 || commands.length === 0 || generatedOutputs.length === 0)) {
        warnings.push("HydraDB did not return a complete source-command-output chain for this target.");
      }

      return {
        ...fallback,
        sources,
        commands,
        generatedOutputs,
        consumers,
        tests,
        warnings: [...new Set(warnings)],
        engine: "hydradb",
        hydraQueries: evidence.records.map((record) => record.query),
      };
    } catch (error) {
      this.hydraConnectedValue = false;
      this.hydraError = errorMessage(error);
      fallback.warnings.push(`HydraDB traversal failed; this answer uses the in-process graph: ${this.hydraError}`);
      return fallback;
    }
  }

  async checkPatch(changedFiles: string[]): Promise<PatchGateResult> {
    const fallback = checkPatch(this.memoryGraphValue, changedFiles);
    if (!this.hydra || !this.hydraConnectedValue) return fallback;

    try {
      return await this.checkPatchWithHydra(fallback);
    } catch (error) {
      this.hydraConnectedValue = false;
      this.hydraError = errorMessage(error);
      fallback.reasons.push("HydraDB traversal was unavailable, so this gate used the deterministic in-process fallback.");
      fallback.contextPack = renderContextPack(fallback);
      return fallback;
    }
  }

  private async checkPatchWithHydra(fallback: PatchGateResult): Promise<PatchGateResult> {
    if (!this.hydra) return fallback;

    const changedNodes = fallback.changedFiles
      .map((filePath) => this.memoryGraphValue.findByPath(filePath))
      .filter((node): node is ArtifactNode => node !== undefined);
    const changedIds = new Set(changedNodes.map((node) => node.id));
    const unknownFiles = fallback.changedFiles.filter((filePath) => !this.memoryGraphValue.findByPath(filePath));
    const generatedEdits = changedNodes.filter((node) => node.kind === "generated_file");
    const changedSources = changedNodes.filter((node) => isAuthoritativeTarget(node));
    const targets = uniqueBy([...generatedEdits, ...changedSources], (node) => node.id);

    if (targets.length === 0) {
      const query = "MATCH (n:GenTetherArtifact) WHERE n.repository_id = $repositoryId RETURN count(*) AS total";
      await this.hydra.query(query, { repositoryId: this.snapshotValue.repositoryId });
      return { ...fallback, engine: "hydradb", hydraQueries: [query] };
    }

    const evidenceByTarget = new Map<number, HydraLineageEvidence>();
    for (const target of targets) evidenceByTarget.set(target.id, await this.hydra.resolveLineage(target));

    const authoritativeSources: ArtifactNode[] = [];
    const staleOutputs: ArtifactNode[] = [];
    const commands: ArtifactNode[] = [];
    const consumers: ArtifactNode[] = [];
    const tests: ArtifactNode[] = [];
    const reasons: string[] = [];
    const decisions: GateDecision[] = [];
    const queries = new Set<string>();

    if (fallback.changedFiles.length === 0) {
      decisions.push("REVIEW");
      reasons.push("No changed files were supplied, so GenTether cannot prove the edit is safe.");
    }
    if (unknownFiles.length > 0) {
      decisions.push("REVIEW");
      reasons.push(`The graph does not contain ${unknownFiles.join(", ")}; re-index the repository before trusting this patch.`);
    }

    for (const generated of generatedEdits) {
      const evidence = evidenceByTarget.get(generated.id) ?? emptyEvidence();
      addQueries(queries, evidence);
      const liveSources = this.nodesFor(evidence.sourceIds);
      const liveCommands = this.nodesFor(evidence.commandIds);
      const liveOutputs = this.nodesFor(evidence.generatedIds);
      const liveDownstream = this.nodesFor(evidence.consumerIds);
      authoritativeSources.push(...liveSources);
      commands.push(...liveCommands);
      splitDownstream(liveDownstream, consumers, tests);

      const completeChain =
        liveSources.length > 0 && liveCommands.length > 0 && liveOutputs.some((node) => node.id === generated.id);
      if (!completeChain) {
        decisions.push("REVIEW");
        reasons.push(
          `${generated.path} looks generated, but HydraDB did not return a complete source-command-output chain. Do not edit it until provenance is established.`,
        );
        continue;
      }

      const authoritativeIds = new Set([
        ...evidence.sourceIds,
        ...evidence.commandIds,
        ...evidence.declarationIds,
      ]);
      const changedAuthoritative = [...authoritativeIds].some((id) => changedIds.has(id));
      if (!changedAuthoritative) {
        decisions.push("BLOCK");
        reasons.push(
          `${generated.path} is generated. Edit ${liveSources.map((node) => node.path).join(" or ")} and run ${liveCommands
            .map(commandLabel)
            .join(" / ")} instead.`,
        );
      } else {
        decisions.push("ALLOW");
        reasons.push(`${generated.path} changed together with an authoritative source or generator declaration.`);
      }
    }

    for (const source of changedSources) {
      const evidence = evidenceByTarget.get(source.id) ?? emptyEvidence();
      addQueries(queries, evidence);
      const liveSources = this.nodesFor(evidence.sourceIds);
      const liveCommands = this.nodesFor(evidence.commandIds);
      const liveOutputs = this.nodesFor(evidence.generatedIds);
      const liveDownstream = this.nodesFor(evidence.consumerIds);
      authoritativeSources.push(...liveSources);
      commands.push(...liveCommands);
      splitDownstream(liveDownstream, consumers, tests);

      if (liveOutputs.length === 0) {
        decisions.push("REVIEW");
        reasons.push(`${source.path} is generation-related, but HydraDB returned no connected generated output.`);
        continue;
      }

      const missingOutputs = liveOutputs.filter((output) => !changedIds.has(output.id));
      if (missingOutputs.length > 0) {
        decisions.push("REVIEW");
        staleOutputs.push(...missingOutputs);
        reasons.push(
          `${source.path} changed without ${missingOutputs.map((node) => node.path).join(", ")}. Regenerate and include the derived output.`,
        );
      } else {
        decisions.push("ALLOW");
        reasons.push(`${source.path} and every HydraDB-connected generated output changed together.`);
      }
    }

    if (generatedEdits.length === 0 && changedSources.length === 0 && unknownFiles.length === 0 && fallback.changedFiles.length > 0) {
      decisions.push("ALLOW");
      reasons.push("No changed path is marked as generated or as an authoritative generation source.");
    }

    const decision = decisions.sort((a, b) => severity(b) - severity(a))[0] ?? "REVIEW";
    const uniqueCommands = uniqueBy(commands, (node) => node.id);
    const uniqueTests = uniqueBy(tests, (node) => node.id);
    const result: PatchGateResult = {
      decision,
      changedFiles: fallback.changedFiles,
      generatedEdits: uniqueBy(generatedEdits, (node) => node.id),
      authoritativeSources: uniqueBy(authoritativeSources, (node) => node.id),
      staleOutputs: uniqueBy(staleOutputs, (node) => node.id),
      commands: uniqueCommands,
      consumers: uniqueBy(consumers, (node) => node.id),
      tests: uniqueTests,
      // The exact edge chains come from the immutable scanner snapshot that was
      // ingested. Membership and gate severity above come from HydraDB rows.
      paths: fallback.paths,
      reasons: [...new Set(reasons)],
      verificationCommands: buildVerificationCommands(uniqueCommands, uniqueTests),
      contextPack: "",
      engine: "hydradb",
      hydraQueries: [...queries],
    };
    result.contextPack = renderContextPack(result);
    return result;
  }

  private nodesFor(ids: number[]): ArtifactNode[] {
    return ids
      .map((id) => this.memoryGraphValue.getNode(id))
      .filter((node): node is ArtifactNode => node !== undefined);
  }

  private async syncHydra(attemptsInput = 1, delayMsInput = 0): Promise<void> {
    this.hydraConnectedValue = false;
    this.hydraError = undefined;
    if (!this.hydra) return;

    const attempts = Math.max(1, Math.trunc(attemptsInput));
    const delayMs = Math.max(0, Math.trunc(delayMsInput));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.hydra.replaceGraph(this.snapshotValue);
        this.hydraConnectedValue = true;
        this.hydraError = undefined;
        return;
      } catch (error) {
        this.hydraError = errorMessage(error);
        if (attempt < attempts && delayMs > 0) await wait(delayMs);
      }
    }
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function splitDownstream(nodes: ArtifactNode[], consumers: ArtifactNode[], tests: ArtifactNode[]): void {
  for (const node of nodes) {
    if (node.kind === "test") tests.push(node);
    else if (node.kind !== "generated_file" && node.kind !== "generator_command") consumers.push(node);
  }
}

function isAuthoritativeTarget(node: ArtifactNode): boolean {
  return node.kind === "source_spec" || node.kind === "generator_config" || node.kind === "generator_command";
}

function isGenerationTarget(node: ArtifactNode): boolean {
  return node.kind === "generated_file" || isAuthoritativeTarget(node);
}

function commandLabel(node: ArtifactNode): string {
  const run = node.metadata.run;
  return typeof run === "string" ? `\`${run}\`` : `the ${node.name} generator`;
}

function addQueries(target: Set<string>, evidence: HydraLineageEvidence): void {
  for (const record of evidence.records) target.add(record.query);
}

function emptyEvidence(): HydraLineageEvidence {
  return { sourceIds: [], commandIds: [], generatedIds: [], declarationIds: [], consumerIds: [], records: [] };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
