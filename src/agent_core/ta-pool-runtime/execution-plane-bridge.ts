import type { CapabilityInvocationPlan } from "../capability-types/index.js";
import type { CapabilityGrant, DecisionToken } from "../ta-pool-types/index.js";
import {
  TA_ENFORCEMENT_METADATA_KEY,
  createTaExecutionEnforcement,
} from "./enforcement-guard.js";

export interface TaPoolExecutionRequest {
  requestId: string;
  sessionId: string;
  runId: string;
  intentId: string;
  capabilityKey: string;
  operation: string;
  input: Record<string, unknown>;
  priority: CapabilityInvocationPlan["priority"];
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export type GrantExecutionRequest = TaPoolExecutionRequest;

export interface GrantToInvocationPlanInput {
  grant: CapabilityGrant;
  request: TaPoolExecutionRequest;
  decisionToken?: DecisionToken;
}

export interface TaExecutionGovernanceMetadata {
  family: "shell" | "code" | "generic";
  operation: string;
  subject?: string;
  pathCandidates?: string[];
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/");
}

function normalizePathArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = [...new Set(
    values
      .map((value) => normalizeString(value))
      .filter((value): value is string => !!value)
      .map(normalizePath),
  )];
  return normalized.length > 0 ? normalized : undefined;
}

function resolveExecutionFamily(capabilityKey: string): TaExecutionGovernanceMetadata["family"] {
  if (capabilityKey.startsWith("shell.")) {
    return "shell";
  }
  if (capabilityKey.startsWith("code.")) {
    return "code";
  }
  return "generic";
}

function resolveExecutionPathCandidates(input: Record<string, unknown>): string[] | undefined {
  const candidates = [
    normalizeString(input.path),
    normalizeString(input.targetPath),
    normalizeString(input.filePath),
    normalizeString(input.cwd),
    normalizeString(input.workdir),
    normalizeString(input.workingDirectory),
    normalizeString(input.rootDir),
    normalizeString(input.repoRoot),
  ]
    .filter((value): value is string => !!value)
    .map(normalizePath);

  const arrayCandidates = [
    ...(normalizePathArray(input.paths) ?? []),
    ...(normalizePathArray(input.targetPaths) ?? []),
    ...(normalizePathArray(input.filePaths) ?? []),
  ];

  const normalized = [...new Set([...candidates, ...arrayCandidates])];
  return normalized.length > 0 ? normalized : undefined;
}

function resolveExecutionSubject(
  input: Record<string, unknown>,
  pathCandidates?: readonly string[],
): string | undefined {
  const directSubject = [
    normalizeString(input.command),
    normalizeString(input.script),
    normalizeString(input.action),
    normalizeString(input.task),
    normalizeString(input.prompt),
    normalizeString(input.url),
  ].find((value): value is string => !!value);

  return directSubject ?? pathCandidates?.[0];
}

export function createExecutionGovernanceMetadata(params: {
  capabilityKey: string;
  operation: string;
  input: Record<string, unknown>;
}): TaExecutionGovernanceMetadata {
  const pathCandidates = resolveExecutionPathCandidates(params.input);
  return {
    family: resolveExecutionFamily(params.capabilityKey),
    operation: params.operation,
    subject: resolveExecutionSubject(params.input, pathCandidates),
    pathCandidates,
  };
}

function assertGrantCanLowerRequest(input: GrantToInvocationPlanInput): void {
  if (input.request.capabilityKey !== input.grant.capabilityKey) {
    throw new Error(
      `Execution request ${input.request.requestId} targets ${input.request.capabilityKey}, but grant ${input.grant.grantId} only allows ${input.grant.capabilityKey}.`,
    );
  }
}

function deriveOperation(capabilityKey: string): string {
  return capabilityKey.split(".").slice(1).join(".") || capabilityKey;
}

export function createExecutionRequest(input: TaPoolExecutionRequest): TaPoolExecutionRequest {
  const operation = input.operation.trim() || deriveOperation(input.capabilityKey);
  const executionGovernance = createExecutionGovernanceMetadata({
    capabilityKey: input.capabilityKey,
    operation,
    input: input.input,
  });

  return {
    ...input,
    operation,
    metadata: {
      ...(input.metadata ?? {}),
      executionGovernance,
    },
  };
}

export function canGrantExecuteRequest(
  input: Partial<TaPoolExecutionRequest>,
): input is TaPoolExecutionRequest {
  return (
    typeof input.requestId === "string" &&
    input.requestId.length > 0 &&
    typeof input.sessionId === "string" &&
    input.sessionId.length > 0 &&
    typeof input.runId === "string" &&
    input.runId.length > 0 &&
    typeof input.intentId === "string" &&
    input.intentId.length > 0 &&
    typeof input.capabilityKey === "string" &&
    input.capabilityKey.length > 0 &&
    typeof input.operation === "string" &&
    !!input.input &&
    typeof input.input === "object" &&
    typeof input.priority === "string"
  );
}

export function createInvocationPlanFromGrant(
  input: GrantToInvocationPlanInput,
): CapabilityInvocationPlan {
  assertGrantCanLowerRequest(input);
  const request = createExecutionRequest(input.request);
  const taEnforcement = createTaExecutionEnforcement({
    executionRequestId: request.requestId,
    capabilityKey: request.capabilityKey,
    grant: input.grant,
    decisionToken: input.decisionToken,
  });
  return {
    planId: request.requestId,
    intentId: request.intentId,
    sessionId: request.sessionId,
    runId: request.runId,
    capabilityKey: input.grant.capabilityKey,
    operation: request.operation,
    input: request.input,
    timeoutMs: request.timeoutMs,
    idempotencyKey: `${input.grant.grantId}:${request.requestId}`,
    priority: request.priority,
    metadata: {
      ...(input.grant.metadata ?? {}),
      ...(request.metadata ?? {}),
      bridge: "ta-pool",
      grantId: input.grant.grantId,
      grantTier: input.grant.grantedTier,
      grantMode: input.grant.mode,
      grantedScope: input.grant.grantedScope,
      constraints: input.grant.constraints,
      requestId: request.requestId,
      accessRequestId: input.grant.requestId,
      executionGovernance: request.metadata?.executionGovernance,
      [TA_ENFORCEMENT_METADATA_KEY]: taEnforcement,
    },
  };
}
