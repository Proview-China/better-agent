import type { BootstrapCmpProjectInfraInput } from "../../agent_core/runtime.js";
import { createRaxCmpConfig, type RaxCmpConfig } from "../cmp-config.js";
import type {
  RaxCmpBootstrapInput,
  RaxCmpCreateInput,
  RaxCmpPort,
  RaxCmpSession,
  RaxCmpSessionApi,
} from "../cmp-types.js";
import { resolveControlSurface } from "./control.js";

export function assertRuntime(runtime: RaxCmpPort | undefined): RaxCmpPort {
  if (!runtime) {
    throw new Error("RAX CMP facade requires either input.runtime or a runtimeFactory.");
  }
  return runtime;
}

export function resolveBootstrapPayload(input: RaxCmpBootstrapInput): BootstrapCmpProjectInfraInput {
  return {
    projectId: input.payload.projectId ?? input.session.config.projectId,
    repoName: input.payload.repoName ?? input.session.config.git.repoName,
    repoRootPath: input.payload.repoRootPath ?? input.session.config.git.repoRootPath,
    agents: input.payload.agents,
    defaultAgentId: input.payload.defaultAgentId ?? input.session.config.defaultAgentId,
    defaultBranchName: input.payload.defaultBranchName ?? input.session.config.git.defaultBranchName,
    worktreeRootPath: input.payload.worktreeRootPath ?? input.session.config.git.worktreeRootPath,
    databaseName: input.payload.databaseName ?? input.session.config.db.databaseName,
    dbSchemaName: input.payload.dbSchemaName ?? input.session.config.db.schemaName,
    redisNamespaceRoot: input.payload.redisNamespaceRoot ?? input.session.config.mq.namespaceRoot,
    metadata: {
      sessionId: input.session.sessionId,
      ...(input.payload.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

export function createRaxCmpSessionApi(input: {
  runtimeFactory?: (config: RaxCmpConfig) => RaxCmpPort;
  now?: () => Date;
  sessionIdFactory: () => string;
}): RaxCmpSessionApi {
  const now = input.now ?? (() => new Date());

  return {
    open(createInput: RaxCmpCreateInput): RaxCmpSession {
      const config = createRaxCmpConfig(createInput.config);
      const runtime = assertRuntime(
        createInput.runtime ?? input.runtimeFactory?.(config),
      );
      const control = resolveControlSurface({
        projectId: config.projectId,
        override: createInput.control,
      });
      return {
        sessionId: input.sessionIdFactory(),
        projectId: config.projectId,
        createdAt: now().toISOString(),
        config,
        control,
        runtime,
        metadata: createInput.metadata,
      };
    },
  };
}
