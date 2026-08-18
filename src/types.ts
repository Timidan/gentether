export type ArtifactKind =
  | "repository"
  | "file"
  | "source_spec"
  | "generator_config"
  | "generator_command"
  | "generated_file"
  | "test";

export type RelationType =
  | "CONTAINS"
  | "DECLARES"
  | "FEEDS"
  | "GENERATES"
  | "IMPORTS"
  | "VERIFIES";

export type GateDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface ArtifactNode {
  id: number;
  key: string;
  kind: ArtifactKind;
  name: string;
  path: string;
  metadata: Record<string, string | number | boolean>;
}

export interface ArtifactEdge {
  id: number;
  from: number;
  to: number;
  type: RelationType;
  evidence: string;
  confidence: number;
}

export interface ScanWarning {
  path?: string;
  message: string;
}

export interface RepositoryGraph {
  repositoryId: string;
  root: string;
  nodes: ArtifactNode[];
  edges: ArtifactEdge[];
  warnings: ScanWarning[];
  stats: {
    files: number;
    generatedFiles: number;
    sourceSpecs: number;
    commands: number;
    relationships: number;
  };
}

export interface EvidencePath {
  label: string;
  nodes: ArtifactNode[];
  edges: ArtifactEdge[];
  confidence: number;
}

export interface LineageResult {
  target: ArtifactNode;
  sources: ArtifactNode[];
  commands: ArtifactNode[];
  generatedOutputs: ArtifactNode[];
  consumers: ArtifactNode[];
  tests: ArtifactNode[];
  paths: EvidencePath[];
  warnings: string[];
  engine: "memory" | "hydradb";
  hydraQueries?: string[];
}

export interface PatchGateResult {
  decision: GateDecision;
  changedFiles: string[];
  generatedEdits: ArtifactNode[];
  authoritativeSources: ArtifactNode[];
  staleOutputs: ArtifactNode[];
  commands: ArtifactNode[];
  consumers: ArtifactNode[];
  tests: ArtifactNode[];
  paths: EvidencePath[];
  reasons: string[];
  verificationCommands: string[];
  contextPack: string;
  engine: "memory" | "hydradb";
  hydraQueries?: string[];
}

export interface GraphStatus {
  repositoryId: string;
  root: string;
  engine: "memory" | "hydradb";
  hydraConnected: boolean;
  stats: RepositoryGraph["stats"];
  warnings: ScanWarning[];
}
