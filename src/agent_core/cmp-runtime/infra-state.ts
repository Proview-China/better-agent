import type { CmpProjectDbBootstrapContract, CmpProjectDbBootstrapReceipt } from "../cmp-db/index.js";
import type {
  CmpGitAgentBranchRuntime,
  CmpGitBackendBootstrapReceipt,
  CmpGitLineageNode,
} from "../cmp-git/index.js";
import type { CmpRedisProjectBootstrap } from "../cmp-mq/index.js";
import type { CmpProjectInfraBootstrapReceipt } from "./infra-bootstrap.js";

export interface CmpGitBranchBootstrapRecord {
  agentId: string;
  createdBranchNames: string[];
}

export interface CmpRuntimeInfraProjectState {
  projectId: string;
  git?: CmpGitBackendBootstrapReceipt;
  gitBranchBootstraps: CmpGitBranchBootstrapRecord[];
  branchRuntimes: CmpGitAgentBranchRuntime[];
  db?: CmpProjectDbBootstrapContract;
  dbReceipt?: CmpProjectDbBootstrapReceipt;
  mqBootstraps: CmpRedisProjectBootstrap[];
  lineages: CmpGitLineageNode[];
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRuntimeInfraState {
  projects: CmpRuntimeInfraProjectState[];
  metadata?: Record<string, unknown>;
}

export interface CmpRuntimeHydratedInfraState {
  projects: Map<string, CmpRuntimeInfraProjectState>;
}

export interface CmpRuntimeInfraProjectReadbackSummary {
  projectId: string;
  gitStatus?: CmpGitBackendBootstrapReceipt["status"];
  gitBranchBootstrapCount: number;
  branchRuntimeCount: number;
  dbReceiptStatus?: CmpProjectDbBootstrapReceipt["status"];
  expectedDbTargetCount?: number;
  presentDbTargetCount?: number;
  mqBootstrapCount: number;
  mqTopicBindingCount: number;
  hydratedLineageCount: number;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function cloneBranchBootstrapRecord(record: CmpGitBranchBootstrapRecord): CmpGitBranchBootstrapRecord {
  return {
    agentId: assertNonEmpty(record.agentId, "CMP infra branch bootstrap agentId"),
    createdBranchNames: [...new Set(record.createdBranchNames.map((name) => assertNonEmpty(name, "CMP infra branch bootstrap branchName")))],
  };
}

export function createCmpRuntimeInfraProjectState(
  input: CmpRuntimeInfraProjectState,
): CmpRuntimeInfraProjectState {
  return {
    projectId: assertNonEmpty(input.projectId, "CMP infra projectId"),
    git: input.git ? structuredClone(input.git) : undefined,
    gitBranchBootstraps: input.gitBranchBootstraps.map(cloneBranchBootstrapRecord),
    branchRuntimes: input.branchRuntimes.map((runtime) => structuredClone(runtime)),
    db: input.db ? structuredClone(input.db) : undefined,
    dbReceipt: input.dbReceipt ? structuredClone(input.dbReceipt) : undefined,
    mqBootstraps: input.mqBootstraps.map((bootstrap) => structuredClone(bootstrap)),
    lineages: input.lineages.map((lineage) => structuredClone(lineage)),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP infra updatedAt"),
    metadata: input.metadata ? structuredClone(input.metadata) : undefined,
  };
}

export function createCmpRuntimeInfraState(
  input: CmpRuntimeInfraState = { projects: [] },
): CmpRuntimeInfraState {
  const seen = new Set<string>();
  return {
    projects: input.projects.map((project) => {
      const normalized = createCmpRuntimeInfraProjectState(project);
      if (seen.has(normalized.projectId)) {
        throw new Error(`Duplicate CMP infra project state detected: ${normalized.projectId}.`);
      }
      seen.add(normalized.projectId);
      return normalized;
    }),
    metadata: input.metadata ? structuredClone(input.metadata) : undefined,
  };
}

export function recordCmpProjectInfraBootstrapReceipt(input: {
  state?: CmpRuntimeInfraState;
  receipt: CmpProjectInfraBootstrapReceipt;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): CmpRuntimeInfraState {
  const normalized = createCmpRuntimeInfraState(input.state);
  const nextProjectState = createCmpRuntimeInfraProjectState({
    projectId: input.receipt.git.projectRepo.projectId,
    git: input.receipt.git,
    gitBranchBootstraps: input.receipt.gitBranchBootstraps.map((record) => ({
      agentId: record.agentId,
      createdBranchNames: [...record.createdBranchNames],
    })),
    branchRuntimes: input.receipt.branchRuntimes,
    db: input.receipt.db,
    dbReceipt: input.receipt.dbReceipt,
    mqBootstraps: input.receipt.mqBootstraps,
    lineages: input.receipt.lineages,
    updatedAt: input.updatedAt,
    metadata: input.metadata,
  });

  const projects = normalized.projects.filter((project) => project.projectId !== nextProjectState.projectId);
  projects.push(nextProjectState);
  return createCmpRuntimeInfraState({
    projects,
    metadata: normalized.metadata,
  });
}

export function getCmpRuntimeInfraProjectState(
  state: CmpRuntimeInfraState | undefined,
  projectId: string,
): CmpRuntimeInfraProjectState | undefined {
  const normalizedProjectId = assertNonEmpty(projectId, "CMP infra lookup projectId");
  return createCmpRuntimeInfraState(state).projects.find((project) => project.projectId === normalizedProjectId);
}

export function hydrateCmpRuntimeInfraState(
  state?: CmpRuntimeInfraState,
): CmpRuntimeHydratedInfraState {
  const normalized = createCmpRuntimeInfraState(state);
  const projects = new Map<string, CmpRuntimeInfraProjectState>();
  for (const project of normalized.projects) {
    if (projects.has(project.projectId)) {
      throw new Error(`Duplicate CMP infra hydrated project state detected: ${project.projectId}.`);
    }
    projects.set(project.projectId, createCmpRuntimeInfraProjectState(project));
  }
  return {
    projects,
  };
}

export function summarizeCmpRuntimeInfraProjectState(
  project: CmpRuntimeInfraProjectState,
): CmpRuntimeInfraProjectReadbackSummary {
  const normalized = createCmpRuntimeInfraProjectState(project);
  return {
    projectId: normalized.projectId,
    gitStatus: normalized.git?.status,
    gitBranchBootstrapCount: normalized.gitBranchBootstraps.length,
    branchRuntimeCount: normalized.branchRuntimes.length,
    dbReceiptStatus: normalized.dbReceipt?.status,
    expectedDbTargetCount: normalized.dbReceipt?.expectedTargetCount,
    presentDbTargetCount: normalized.dbReceipt?.presentTargetCount,
    mqBootstrapCount: normalized.mqBootstraps.length,
    mqTopicBindingCount: normalized.mqBootstraps.reduce((count, bootstrap) => {
      return count + bootstrap.topicBindings.length;
    }, 0),
    hydratedLineageCount: normalized.lineages.length,
  };
}
