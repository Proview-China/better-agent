import { randomUUID } from "node:crypto";

import { getCmpFiveAgentRoleDefinition } from "./configuration.js";
import type {
  CmpRoleConfiguration,
  CmpRoleLiveLlmExecutor,
  CmpRoleLiveLlmExecutorResult,
  CmpRoleLiveLlmMode,
  CmpRoleLiveLlmOutcome,
  CmpRoleLiveLlmRequest,
  CmpRoleLiveLlmTrace,
  CmpFiveAgentRole,
} from "./types.js";

export type {
  CmpRoleLiveLlmExecutor,
  CmpRoleLiveLlmExecutorResult as CmpRoleLiveLlmResponse,
  CmpRoleLiveLlmMode,
  CmpRoleLiveLlmOutcome,
  CmpRoleLiveLlmRequest,
  CmpRoleLiveLlmTrace,
};

export interface CmpRoleLiveLlmCompatPrompt {
  system: string;
  user: string;
}

export interface CmpRoleLiveLlmCompatRequest<TOutput = Record<string, unknown>> {
  role: CmpFiveAgentRole;
  mode?: CmpRoleLiveLlmMode;
  prompt: CmpRoleLiveLlmCompatPrompt;
  fallbackOutput: TOutput;
  metadata?: Record<string, unknown>;
}

function normalizeMode(mode?: CmpRoleLiveLlmMode): CmpRoleLiveLlmMode {
  return mode ?? "rules_only";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createCmpRoleLivePrompt(input: {
  role: CmpFiveAgentRole;
  taskLabel?: string;
  schemaTitle?: string;
  schemaFields?: string[];
  inputContext: Record<string, unknown>;
}): string {
  const taskLabel = input.taskLabel ?? `run ${input.role} live llm step`;
  const schemaTitle = input.schemaTitle ?? `${input.role} structured output`;
  const schemaFields = input.schemaFields ?? [];
  return [
    `Role: ${input.role}`,
    `Task: ${taskLabel}`,
    `Return schema: ${schemaTitle}`,
    `Required fields: ${schemaFields.join(", ")}`,
    "Input context JSON:",
    JSON.stringify(input.inputContext, null, 2),
  ].join("\n");
}

export function createCmpRoleLiveLlmPrompt(input: {
  configuration: CmpRoleConfiguration;
  task: string;
  payload: Record<string, unknown>;
}): CmpRoleLiveLlmCompatPrompt {
  return {
    system: [
      `CMP role ${input.configuration.role}`,
      input.configuration.promptPack.systemPrompt,
      `Mission: ${input.configuration.promptPack.mission}`,
      "Return only structured output.",
      `Guardrails: ${input.configuration.promptPack.guardrails.join("; ")}`,
    ].join("\n"),
    user: createCmpRoleLivePrompt({
      role: input.configuration.role,
      taskLabel: input.task,
      schemaTitle: "StructuredOutput",
      schemaFields: input.configuration.promptPack.outputContract,
      inputContext: input.payload,
    }),
  };
}

export function attachCmpRoleLiveAudit(input: {
  metadata?: Record<string, unknown>;
  audit: {
    mode: CmpRoleLiveLlmMode;
    status: "llm_applied" | "fallback_applied" | "rules_only";
    provider?: string;
    model?: string;
    requestId?: string;
    error?: string;
    fallbackApplied: boolean;
  };
  extras?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...(input.metadata ?? {}),
    ...(input.extras ?? {}),
    liveLlm: {
      mode: input.audit.mode,
      status:
        input.audit.status === "llm_applied"
          ? "succeeded"
          : input.audit.status === "fallback_applied"
            ? "fallback"
            : "rules_only",
      provider: input.audit.provider,
      model: input.audit.model,
      requestId: input.audit.requestId,
      errorMessage: input.audit.error,
      fallbackApplied: input.audit.fallbackApplied,
    },
  };
}

export function createCmpRoleLiveLlmRequest<TInput>(input: {
  role: CmpFiveAgentRole;
  agentId: string;
  mode?: CmpRoleLiveLlmMode;
  stage: string;
  createdAt: string;
  configuration: CmpRoleConfiguration;
  taskLabel?: string;
  schemaTitle?: string;
  schemaFields?: string[];
  input: TInput;
  metadata?: Record<string, unknown>;
}): CmpRoleLiveLlmRequest<TInput> {
  const system = [
    `CMP role ${input.configuration.role}`,
    input.configuration.promptPack.systemPrompt,
    `Mission: ${input.configuration.promptPack.mission}`,
    "Return only structured output.",
    `Guardrails: ${input.configuration.promptPack.guardrails.join("; ")}`,
  ].join("\n");
  const user = createCmpRoleLivePrompt({
    role: input.role,
    taskLabel: input.taskLabel,
    schemaTitle: input.schemaTitle,
    schemaFields: input.schemaFields,
    inputContext: input.input as Record<string, unknown>,
  });
  return {
    requestId: randomUUID(),
    role: input.role,
    agentId: input.agentId,
    mode: normalizeMode(input.mode),
    stage: input.stage,
    createdAt: input.createdAt,
    promptPackId: input.configuration.promptPack.promptPackId,
    profileId: input.configuration.profile.profileId,
    prompt: {
      system,
      user,
      systemPrompt: input.configuration.promptPack.systemPrompt,
      systemPurpose: input.configuration.promptPack.systemPurpose,
      mission: input.configuration.promptPack.mission,
      guardrails: [...input.configuration.promptPack.guardrails],
      inputContract: [...input.configuration.promptPack.inputContract],
      outputContract: [...input.configuration.promptPack.outputContract],
      handoffContract: input.configuration.promptPack.handoffContract,
    },
    input: input.input,
    metadata: {
      taskLabel: input.taskLabel,
      schemaTitle: input.schemaTitle,
      schemaFields: input.schemaFields,
      promptText: user,
      ...(input.metadata ?? {}),
    },
  };
}

function createTrace(input: {
  role: CmpFiveAgentRole;
  mode: CmpRoleLiveLlmMode;
  stage: string;
  status: CmpRoleLiveLlmTrace["status"];
  createdAt: string;
  requestId?: string;
  provider?: string;
  model?: string;
  fallbackApplied: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): CmpRoleLiveLlmTrace {
  return {
    attemptId: randomUUID(),
    role: input.role,
    mode: input.mode,
    stage: input.stage,
    status: input.status,
    provider: input.provider,
    model: input.model,
    requestId: input.requestId,
    createdAt: input.createdAt,
    completedAt: new Date().toISOString(),
    fallbackApplied: input.fallbackApplied,
    errorMessage: input.errorMessage,
    metadata: input.metadata,
  };
}

export function toCmpRoleLiveAuditFromTrace(trace: CmpRoleLiveLlmTrace): {
  mode: CmpRoleLiveLlmMode;
  status: "llm_applied" | "fallback_applied" | "rules_only";
  provider?: string;
  model?: string;
  requestId?: string;
  error?: string;
  fallbackApplied: boolean;
} {
  return {
    mode: trace.mode,
    status:
      trace.status === "live_applied"
        ? "llm_applied"
        : trace.status === "fallback_rules"
          ? "fallback_applied"
          : "rules_only",
    provider: trace.provider,
    model: trace.model,
    requestId: trace.requestId,
    error: trace.errorMessage,
    fallbackApplied: trace.fallbackApplied,
  };
}

export async function executeCmpRoleLiveStep<TInput, TOutput>(input: {
  role: CmpFiveAgentRole;
  mode?: CmpRoleLiveLlmMode;
  executor?: CmpRoleLiveLlmExecutor<TInput, TOutput>;
  buildRequest: () => CmpRoleLiveLlmRequest<TInput>;
  applySuccess: (output: TOutput) => TOutput;
  fallback: () => TOutput;
}): Promise<{ result: TOutput; audit: Record<string, unknown>["liveLlm"]; trace: CmpRoleLiveLlmTrace; raw?: unknown }> {
  const mode = normalizeMode(input.mode);
  const request = input.buildRequest();

  if (mode === "rules_only" || !input.executor) {
    const trace = createTrace({
      role: input.role,
      mode,
      stage: request.stage,
      status: "rules_only",
      createdAt: request.createdAt,
      requestId: request.requestId,
      fallbackApplied: false,
    });
    return {
      result: input.fallback(),
      audit: attachCmpRoleLiveAudit({
        audit: toCmpRoleLiveAuditFromTrace(trace),
      }).liveLlm,
      trace,
    };
  }

  try {
    const response = await input.executor(request);
    const trace = createTrace({
      role: input.role,
      mode,
      stage: request.stage,
      status: "live_applied",
      createdAt: request.createdAt,
      requestId: response.requestId ?? request.requestId,
      provider: response.provider,
      model: response.model,
      fallbackApplied: false,
      metadata: response.metadata,
    });
    return {
      result: input.applySuccess(response.output),
      audit: attachCmpRoleLiveAudit({
        audit: toCmpRoleLiveAuditFromTrace(trace),
      }).liveLlm,
      trace,
      raw: response.raw,
    };
  } catch (error) {
    if (mode === "llm_required") {
      throw error;
    }
    const trace = createTrace({
      role: input.role,
      mode,
      stage: request.stage,
      status: "fallback_rules",
      createdAt: request.createdAt,
      requestId: request.requestId,
      fallbackApplied: true,
      errorMessage: toErrorMessage(error),
    });
    return {
      result: input.fallback(),
      audit: attachCmpRoleLiveAudit({
        audit: toCmpRoleLiveAuditFromTrace(trace),
      }).liveLlm,
      trace,
    };
  }
}

export async function executeCmpRoleLiveLlm<TOutput>(input: {
  role: CmpFiveAgentRole;
  mode?: CmpRoleLiveLlmMode;
  request: CmpRoleLiveLlmCompatRequest<TOutput>;
  executor?: (request: CmpRoleLiveLlmCompatRequest<TOutput>) => Promise<CmpRoleLiveLlmExecutorResult<TOutput>>;
}): Promise<{
  output: TOutput;
  trace: CmpRoleLiveLlmTrace;
  raw?: unknown;
}> {
  const mode = normalizeMode(input.mode ?? input.request.mode);
  if (mode === "rules_only" || !input.executor) {
    return {
      output: input.request.fallbackOutput,
      trace: createTrace({
        role: input.role,
        mode,
        stage: "compat",
        status: "rules_only",
        createdAt: new Date().toISOString(),
        fallbackApplied: false,
      }),
    };
  }

  try {
    const response = await input.executor(input.request);
    return {
      output: response.output,
      raw: response.raw,
      trace: createTrace({
        role: input.role,
        mode,
        stage: "compat",
        status: "live_applied",
        createdAt: new Date().toISOString(),
        requestId: response.requestId,
        provider: response.provider,
        model: response.model,
        fallbackApplied: false,
      }),
    };
  } catch (error) {
    if (mode === "llm_required") {
      throw error;
    }
    return {
      output: input.request.fallbackOutput,
      trace: createTrace({
        role: input.role,
        mode,
        stage: "compat",
        status: "fallback_rules",
        createdAt: new Date().toISOString(),
        fallbackApplied: true,
        errorMessage: toErrorMessage(error),
      }),
    };
  }
}

export async function executeCmpRoleLiveLlmStep<TInput, TOutput>(input: {
  role: CmpFiveAgentRole;
  agentId: string;
  mode?: CmpRoleLiveLlmMode;
  stage: string;
  createdAt: string;
  configuration: CmpRoleConfiguration;
  taskLabel?: string;
  schemaTitle?: string;
  schemaFields?: string[];
  requestInput: TInput;
  fallbackOutput: TOutput;
  executor?: CmpRoleLiveLlmExecutor<TInput, TOutput>;
  metadata?: Record<string, unknown>;
}): Promise<CmpRoleLiveLlmOutcome<TOutput>> {
  const request = createCmpRoleLiveLlmRequest({
    role: input.role,
    agentId: input.agentId,
    mode: input.mode,
    stage: input.stage,
    createdAt: input.createdAt,
    configuration: input.configuration,
    taskLabel: input.taskLabel,
    schemaTitle: input.schemaTitle,
    schemaFields: input.schemaFields,
    input: input.requestInput,
    metadata: input.metadata,
  });

  const result = await executeCmpRoleLiveStep({
    role: input.role,
    mode: input.mode,
    executor: input.executor,
    buildRequest: () => request,
    applySuccess: (output) => output,
    fallback: () => input.fallbackOutput,
  });

  return {
    mode: normalizeMode(input.mode),
    status: result.trace.status,
    output: result.result,
    trace: result.trace,
    raw: result.raw,
  };
}

export function createCmpRoleLiveCompatConfiguration(role: CmpFiveAgentRole): CmpRoleConfiguration {
  return getCmpFiveAgentRoleDefinition(role);
}
