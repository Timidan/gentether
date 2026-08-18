import type {
  ArtifactNode,
  EvidencePath,
  GateDecision,
  PatchGateResult,
} from "./types.js";
import { escapeMarkdown, normalizeRepoPath, severity, uniqueBy } from "./utils.js";
import { MemoryGraph } from "./graph/memory.js";

export function checkPatch(graph: MemoryGraph, changedFileInputs: string[]): PatchGateResult {
  const changedFiles = [...new Set(changedFileInputs.map(normalizeRepoPath).filter(Boolean))].sort();
  const changedNodes = changedFiles
    .map((filePath) => graph.findByPath(filePath))
    .filter((node): node is ArtifactNode => node !== undefined);
  const unknownFiles = changedFiles.filter((filePath) => !graph.findByPath(filePath));
  const changedIds = new Set(changedNodes.map((node) => node.id));

  const generatedEdits = changedNodes.filter((node) => node.kind === "generated_file");
  const changedSources = changedNodes.filter(
    (node) => node.kind === "source_spec" || node.kind === "generator_config" || node.kind === "generator_command",
  );
  const authoritativeSources: ArtifactNode[] = [];
  const staleOutputs: ArtifactNode[] = [];
  const commands: ArtifactNode[] = [];
  const consumers: ArtifactNode[] = [];
  const tests: ArtifactNode[] = [];
  const paths: EvidencePath[] = [];
  const reasons: string[] = [];
  const decisions: GateDecision[] = [];

  if (changedFiles.length === 0) {
    decisions.push("REVIEW");
    reasons.push("No changed files were supplied, so GenTether cannot prove the edit is safe.");
  }

  if (unknownFiles.length > 0) {
    decisions.push("REVIEW");
    reasons.push(`The graph does not contain ${unknownFiles.join(", ")}; re-index the repository before trusting this patch.`);
  }

  for (const generated of generatedEdits) {
    const lineage = graph.lineage(generated.path);
    if (!lineage) continue;
    authoritativeSources.push(...lineage.sources);
    commands.push(...lineage.commands);
    consumers.push(...lineage.consumers);
    tests.push(...lineage.tests);
    paths.push(...lineage.paths);

    const changedAuthoritative = [
      ...lineage.sources,
      ...lineage.commands,
      ...lineage.commands.flatMap((command) => graph.sources(command, "DECLARES")),
    ].some((node) => changedIds.has(node.id));

    if (lineage.sources.length === 0 || lineage.commands.length === 0) {
      decisions.push("REVIEW");
      reasons.push(
        `${generated.path} looks generated, but its source or regeneration command is unresolved. Do not edit it until provenance is established.`,
      );
    } else if (!changedAuthoritative) {
      decisions.push("BLOCK");
      reasons.push(
        `${generated.path} is generated. Edit ${lineage.sources.map((node) => node.path).join(" or ")} and run ${lineage.commands
          .map(commandLabel)
          .join(" / ")} instead.`,
      );
    } else {
      decisions.push("ALLOW");
      reasons.push(`${generated.path} changed together with an authoritative source or generator declaration.`);
    }
  }

  for (const source of changedSources) {
    const lineage = graph.lineage(source.path);
    if (!lineage) continue;
    authoritativeSources.push(...lineage.sources);
    commands.push(...lineage.commands);
    consumers.push(...lineage.consumers);
    tests.push(...lineage.tests);
    paths.push(...lineage.paths);

    const missingOutputs = lineage.generatedOutputs.filter((output) => !changedIds.has(output.id));
    if (lineage.generatedOutputs.length === 0) {
      decisions.push("REVIEW");
      reasons.push(`${source.path} is generation-related, but no generated output is connected to it.`);
    } else if (missingOutputs.length > 0) {
      decisions.push("REVIEW");
      staleOutputs.push(...missingOutputs);
      reasons.push(
        `${source.path} changed without ${missingOutputs.map((node) => node.path).join(", ")}. Regenerate and include the derived output.`,
      );
    } else {
      decisions.push("ALLOW");
      reasons.push(`${source.path} and every connected generated output changed together.`);
    }
  }

  if (generatedEdits.length === 0 && changedSources.length === 0 && unknownFiles.length === 0 && changedFiles.length > 0) {
    decisions.push("ALLOW");
    reasons.push("No changed path is marked as generated or as an authoritative generation source.");
  }

  const decision = decisions.sort((a, b) => severity(b) - severity(a))[0] ?? "REVIEW";
  const uniqueCommands = uniqueBy(commands, (node) => node.id);
  const uniqueTests = uniqueBy(tests, (node) => node.id);
  const verificationCommands = buildVerificationCommands(uniqueCommands, uniqueTests);
  const result: PatchGateResult = {
    decision,
    changedFiles,
    generatedEdits: uniqueBy(generatedEdits, (node) => node.id),
    authoritativeSources: uniqueBy(authoritativeSources, (node) => node.id),
    staleOutputs: uniqueBy(staleOutputs, (node) => node.id),
    commands: uniqueCommands,
    consumers: uniqueBy(consumers, (node) => node.id),
    tests: uniqueTests,
    paths: uniqueBy(paths, (candidate) =>
      `${candidate.nodes.map((node) => node.id).join(">")}:${candidate.edges.map((edge) => edge.type).join(">")}`,
    ),
    reasons: [...new Set(reasons)],
    verificationCommands,
    contextPack: "",
    engine: "memory",
  };
  result.contextPack = renderContextPack(result);
  return result;
}

function commandLabel(node: ArtifactNode): string {
  const run = node.metadata.run;
  return typeof run === "string" ? `\`${run}\`` : `the ${node.name} generator`;
}

export function buildVerificationCommands(commands: ArtifactNode[], tests: ArtifactNode[]): string[] {
  const values: string[] = [];
  for (const command of commands) {
    const run = command.metadata.run;
    if (typeof run === "string" && run.trim().length > 0) values.push(run.trim());
  }
  if (tests.length > 0) values.push("npm test");
  return [...new Set(values)];
}

export function renderContextPack(result: PatchGateResult): string {
  const lines = [
    `# GenTether patch gate: ${result.decision}`,
    "",
    "## Changed files",
    ...result.changedFiles.map((file) => `- \`${escapeMarkdown(file)}\``),
    "",
    "## Decision evidence",
    ...result.reasons.map((reason) => `- ${reason}`),
  ];

  if (result.authoritativeSources.length > 0) {
    lines.push("", "## Authoritative sources", ...result.authoritativeSources.map((node) => `- \`${escapeMarkdown(node.path)}\``));
  }
  if (result.commands.length > 0) {
    lines.push("", "## Regeneration", ...result.commands.map((node) => `- ${commandLabel(node)}`));
  }
  if (result.consumers.length > 0) {
    lines.push("", "## Downstream consumers", ...result.consumers.map((node) => `- \`${escapeMarkdown(node.path)}\``));
  }
  if (result.tests.length > 0) {
    lines.push("", "## Tests reached through the graph", ...result.tests.map((node) => `- \`${escapeMarkdown(node.path)}\``));
  }
  if (result.verificationCommands.length > 0) {
    lines.push("", "## Run before merging", ...result.verificationCommands.map((command) => `- \`${escapeMarkdown(command)}\``));
  }
  return `${lines.join("\n")}\n`;
}
