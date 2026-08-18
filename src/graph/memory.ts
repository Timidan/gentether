import type {
  ArtifactEdge,
  ArtifactNode,
  EvidencePath,
  LineageResult,
  RelationType,
  RepositoryGraph,
} from "../types.js";
import { normalizeRepoPath, uniqueBy } from "../utils.js";

interface WalkState {
  current: ArtifactNode;
  nodes: ArtifactNode[];
  edges: ArtifactEdge[];
}

export class MemoryGraph {
  readonly snapshot: RepositoryGraph;
  private readonly nodeById: Map<number, ArtifactNode>;
  private readonly nodeByPath: Map<string, ArtifactNode>;
  private readonly outgoingById: Map<number, ArtifactEdge[]>;
  private readonly incomingById: Map<number, ArtifactEdge[]>;

  constructor(snapshot: RepositoryGraph) {
    this.snapshot = snapshot;
    this.nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    this.nodeByPath = new Map(
      snapshot.nodes.filter((node) => node.path.length > 0).map((node) => [normalizeRepoPath(node.path), node]),
    );
    this.outgoingById = new Map();
    this.incomingById = new Map();

    for (const edge of snapshot.edges) {
      const outgoing = this.outgoingById.get(edge.from) ?? [];
      outgoing.push(edge);
      this.outgoingById.set(edge.from, outgoing);
      const incoming = this.incomingById.get(edge.to) ?? [];
      incoming.push(edge);
      this.incomingById.set(edge.to, incoming);
    }
  }

  findByPath(filePath: string): ArtifactNode | undefined {
    return this.nodeByPath.get(normalizeRepoPath(filePath));
  }

  getNode(id: number): ArtifactNode | undefined {
    return this.nodeById.get(id);
  }

  outgoing(node: ArtifactNode, type?: RelationType): ArtifactEdge[] {
    const edges = this.outgoingById.get(node.id) ?? [];
    return type ? edges.filter((edge) => edge.type === type) : [...edges];
  }

  incoming(node: ArtifactNode, type?: RelationType): ArtifactEdge[] {
    const edges = this.incomingById.get(node.id) ?? [];
    return type ? edges.filter((edge) => edge.type === type) : [...edges];
  }

  targets(node: ArtifactNode, type: RelationType): ArtifactNode[] {
    return this.outgoing(node, type)
      .map((edge) => this.getNode(edge.to))
      .filter((candidate): candidate is ArtifactNode => candidate !== undefined);
  }

  sources(node: ArtifactNode, type: RelationType): ArtifactNode[] {
    return this.incoming(node, type)
      .map((edge) => this.getNode(edge.from))
      .filter((candidate): candidate is ArtifactNode => candidate !== undefined);
  }

  generatedDependencies(start: ArtifactNode, maxDepth = 5): EvidencePath[] {
    const results: EvidencePath[] = [];
    const queue: WalkState[] = [{ current: start, nodes: [start], edges: [] }];
    const bestDepth = new Map<number, number>([[start.id, 0]]);

    while (queue.length > 0) {
      const state = queue.shift();
      if (!state) break;
      if (state.edges.length >= maxDepth) continue;

      for (const edge of this.outgoing(state.current, "IMPORTS")) {
        const next = this.getNode(edge.to);
        if (!next || state.nodes.some((node) => node.id === next.id)) continue;
        const nodes = [...state.nodes, next];
        const edges = [...state.edges, edge];
        if (next.kind === "generated_file") {
          results.push({
            label: `${start.path} reaches generated artifact ${next.path}`,
            nodes,
            edges,
            confidence: pathConfidence(edges),
          });
          continue;
        }
        const depth = edges.length;
        const previous = bestDepth.get(next.id);
        if (previous !== undefined && previous <= depth) continue;
        bestDepth.set(next.id, depth);
        queue.push({ current: next, nodes, edges });
      }
    }

    return results;
  }

  reverseImportPaths(output: ArtifactNode, maxDepth = 4): EvidencePath[] {
    const results: EvidencePath[] = [];
    const queue: WalkState[] = [{ current: output, nodes: [output], edges: [] }];
    const bestDepth = new Map<number, number>([[output.id, 0]]);

    while (queue.length > 0) {
      const state = queue.shift();
      if (!state) break;
      if (state.edges.length >= maxDepth) continue;

      for (const edge of this.incoming(state.current, "IMPORTS")) {
        const importer = this.getNode(edge.from);
        if (!importer || state.nodes.some((node) => node.id === importer.id)) continue;
        const nodes = [importer, ...state.nodes];
        const edges = [edge, ...state.edges];
        results.push({
          label:
            importer.kind === "test"
              ? `${importer.path} verifies code backed by ${output.path}`
              : `${importer.path} depends on ${output.path}`,
          nodes,
          edges,
          confidence: pathConfidence(edges),
        });

        const depth = edges.length;
        const previous = bestDepth.get(importer.id);
        if (previous !== undefined && previous <= depth) continue;
        bestDepth.set(importer.id, depth);
        queue.push({ current: importer, nodes, edges });
      }
    }

    return results;
  }

  lineage(filePath: string): LineageResult | undefined {
    const target = this.findByPath(filePath);
    if (!target) return undefined;

    const paths: EvidencePath[] = [];
    const warnings: string[] = [];
    let sources: ArtifactNode[] = [];
    let commands: ArtifactNode[] = [];
    let generatedOutputs: ArtifactNode[] = [];

    if (target.kind === "generated_file") {
      commands = this.sources(target, "GENERATES");
      for (const command of commands) {
        const commandSources = this.sources(command, "FEEDS");
        const declarationNodes = this.sources(command, "DECLARES");
        sources.push(...commandSources);
        generatedOutputs.push(...this.targets(command, "GENERATES"));
        for (const source of commandSources) {
          const feed = this.findEdge(source.id, command.id, "FEEDS");
          const generate = this.findEdge(command.id, target.id, "GENERATES");
          if (feed && generate) {
            paths.push({
              label: `${source.path} generates ${target.path}`,
              nodes: [source, command, target],
              edges: [feed, generate],
              confidence: pathConfidence([feed, generate]),
            });
          }
        }
        for (const declaration of declarationNodes) {
          const declares = this.findEdge(declaration.id, command.id, "DECLARES");
          if (declares) {
            paths.push({
              label: `${declaration.path} declares the regeneration command`,
              nodes: [declaration, command],
              edges: [declares],
              confidence: declares.confidence,
            });
          }
        }
      }
      if (commands.length === 0) warnings.push("No generator command could be resolved for this generated file.");
      if (sources.length === 0) warnings.push("No authoritative source could be resolved for this generated file.");
    } else if (target.kind === "source_spec") {
      sources = [target];
      commands = this.targets(target, "FEEDS");
      for (const command of commands) {
        const outputs = this.targets(command, "GENERATES");
        generatedOutputs.push(...outputs);
        for (const output of outputs) {
          const feed = this.findEdge(target.id, command.id, "FEEDS");
          const generate = this.findEdge(command.id, output.id, "GENERATES");
          if (feed && generate) {
            paths.push({
              label: `${target.path} generates ${output.path}`,
              nodes: [target, command, output],
              edges: [feed, generate],
              confidence: pathConfidence([feed, generate]),
            });
          }
        }
      }
      if (commands.length === 0) warnings.push("This source specification is not connected to a generator command.");
    } else if (target.kind === "generator_command") {
      commands = [target];
      sources = this.sources(target, "FEEDS");
      generatedOutputs = this.targets(target, "GENERATES");
    } else if (target.kind === "generator_config") {
      commands = this.targets(target, "DECLARES");
      for (const command of commands) {
        sources.push(...this.sources(command, "FEEDS"));
        generatedOutputs.push(...this.targets(command, "GENERATES"));
      }
    } else {
      const generatedPaths = this.generatedDependencies(target);
      paths.push(...generatedPaths);
      const generatedTargets = generatedPaths
        .map((candidate) => candidate.nodes.at(-1))
        .filter((candidate): candidate is ArtifactNode => candidate?.kind === "generated_file");
      for (const generated of generatedTargets) {
        const nested = this.lineage(generated.path);
        if (!nested) continue;
        sources.push(...nested.sources);
        commands.push(...nested.commands);
        generatedOutputs.push(...nested.generatedOutputs);
        paths.push(...nested.paths);
        warnings.push(...nested.warnings);
      }
      if (generatedTargets.length === 0) {
        warnings.push("The selected file does not reach a generated artifact within the bounded import graph.");
      }
    }

    sources = uniqueBy(sources, (node) => node.id);
    commands = uniqueBy(commands, (node) => node.id);
    generatedOutputs = uniqueBy(generatedOutputs, (node) => node.id);

    const downstreamPaths = generatedOutputs.flatMap((output) => this.reverseImportPaths(output));
    paths.push(...downstreamPaths);
    const downstreamNodes = downstreamPaths
      .map((candidate) => candidate.nodes[0])
      .filter((candidate): candidate is ArtifactNode => candidate !== undefined);
    const tests = uniqueBy(
      downstreamNodes.filter((node) => node.kind === "test"),
      (node) => node.id,
    );
    const consumers = uniqueBy(
      downstreamNodes.filter(
        (node) => node.kind !== "test" && node.kind !== "generated_file" && node.kind !== "generator_command",
      ),
      (node) => node.id,
    );

    return {
      target,
      sources,
      commands,
      generatedOutputs,
      consumers,
      tests,
      paths: uniqueBy(paths, (candidate) => pathKey(candidate)),
      warnings: [...new Set(warnings)],
      engine: "memory",
    };
  }

  private findEdge(from: number, to: number, type: RelationType): ArtifactEdge | undefined {
    return this.outgoingById.get(from)?.find((edge) => edge.to === to && edge.type === type);
  }
}

function pathConfidence(edges: ArtifactEdge[]): number {
  if (edges.length === 0) return 1;
  return Math.min(...edges.map((edge) => edge.confidence));
}

function pathKey(path: EvidencePath): string {
  return `${path.nodes.map((node) => node.id).join(">")}:${path.edges.map((edge) => edge.type).join(">")}`;
}
