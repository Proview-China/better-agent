import type { CmpGitAgentBranchRuntime } from "../cmp-git/index.js";
import type { CmpRedisProjectBootstrap } from "../cmp-mq/index.js";
import type { CmpRuntimeInfraProjectState } from "./infra-state.js";

export interface CmpProjectInfraAccess {
  project: CmpRuntimeInfraProjectState;
  branchRuntimes: Map<string, CmpGitAgentBranchRuntime>;
  mqBootstraps: Map<string, CmpRedisProjectBootstrap>;
}

export interface CmpAgentInfraAccess {
  projectId: string;
  agentId: string;
  branchRuntime: CmpGitAgentBranchRuntime;
  mqBootstrap?: CmpRedisProjectBootstrap;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createCmpProjectInfraAccess(
  project: CmpRuntimeInfraProjectState,
): CmpProjectInfraAccess {
  const branchRuntimes = new Map<string, CmpGitAgentBranchRuntime>();
  for (const runtime of project.branchRuntimes) {
    const agentId = assertNonEmpty(runtime.agentId, "CMP infra access branch runtime agentId");
    if (branchRuntimes.has(agentId)) {
      throw new Error(`Duplicate CMP branch runtime detected for agent ${agentId}.`);
    }
    branchRuntimes.set(agentId, structuredClone(runtime));
  }

  const mqBootstraps = new Map<string, CmpRedisProjectBootstrap>();
  for (const bootstrap of project.mqBootstraps) {
    const agentId = assertNonEmpty(bootstrap.agentId, "CMP infra access MQ bootstrap agentId");
    if (mqBootstraps.has(agentId)) {
      throw new Error(`Duplicate CMP MQ bootstrap detected for agent ${agentId}.`);
    }
    mqBootstraps.set(agentId, structuredClone(bootstrap));
  }

  return {
    project,
    branchRuntimes,
    mqBootstraps,
  };
}

export function resolveCmpAgentInfraAccess(input: {
  project: CmpRuntimeInfraProjectState;
  agentId: string;
}): CmpAgentInfraAccess {
  const projectAccess = createCmpProjectInfraAccess(input.project);
  const agentId = assertNonEmpty(input.agentId, "CMP infra access agentId");
  const branchRuntime = projectAccess.branchRuntimes.get(agentId);
  if (!branchRuntime) {
    throw new Error(`CMP branch runtime for agent ${agentId} was not found.`);
  }

  return {
    projectId: projectAccess.project.projectId,
    agentId,
    branchRuntime,
    mqBootstrap: projectAccess.mqBootstraps.get(agentId),
  };
}
