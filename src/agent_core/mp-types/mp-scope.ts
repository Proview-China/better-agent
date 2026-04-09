export const MP_SCOPE_LEVELS = [
  "global",
  "project",
  "agent_isolated",
] as const;
export type MpScopeLevel = (typeof MP_SCOPE_LEVELS)[number];

export const MP_SESSION_MODES = [
  "isolated",
  "bridged",
  "shared",
] as const;
export type MpSessionMode = (typeof MP_SESSION_MODES)[number];

export const MP_VISIBILITY_STATES = [
  "local_only",
  "session_bridged",
  "project_shared",
  "global_shared",
  "archived",
] as const;
export type MpVisibilityState = (typeof MP_VISIBILITY_STATES)[number];

export const MP_PROMOTION_STATES = [
  "local_only",
  "submitted_to_parent",
  "accepted_by_parent",
  "promoted_to_project",
  "promoted_to_global",
  "archived",
] as const;
export type MpPromotionState = (typeof MP_PROMOTION_STATES)[number];

export interface MpScopeDescriptor {
  projectId: string;
  agentId: string;
  sessionId?: string;
  scopeLevel: MpScopeLevel;
  sessionMode: MpSessionMode;
  visibilityState: MpVisibilityState;
  promotionState: MpPromotionState;
  lineagePath?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMpScopeDescriptorInput {
  projectId: string;
  agentId: string;
  sessionId?: string;
  scopeLevel?: MpScopeLevel;
  sessionMode?: MpSessionMode;
  visibilityState?: MpVisibilityState;
  promotionState?: MpPromotionState;
  lineagePath?: string[];
  metadata?: Record<string, unknown>;
}

const MP_PROMOTION_STATE_TRANSITIONS: Record<MpPromotionState, readonly MpPromotionState[]> = {
  local_only: ["submitted_to_parent", "archived"],
  submitted_to_parent: ["accepted_by_parent", "archived"],
  accepted_by_parent: ["promoted_to_project", "archived"],
  promoted_to_project: ["promoted_to_global", "archived"],
  promoted_to_global: ["archived"],
  archived: [],
};

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeLineagePath(lineagePath?: string[]): string[] | undefined {
  if (!lineagePath) {
    return undefined;
  }
  const normalized = [...new Set(lineagePath.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function defaultVisibilityState(input: {
  scopeLevel: MpScopeLevel;
  sessionMode: MpSessionMode;
}): MpVisibilityState {
  switch (input.scopeLevel) {
    case "global":
      return "global_shared";
    case "project":
      return "project_shared";
    case "agent_isolated":
      return input.sessionMode === "bridged" ? "session_bridged" : "local_only";
  }
}

function defaultPromotionState(scopeLevel: MpScopeLevel): MpPromotionState {
  switch (scopeLevel) {
    case "global":
      return "promoted_to_global";
    case "project":
      return "promoted_to_project";
    case "agent_isolated":
      return "local_only";
  }
}

export function isMpScopeLevel(value: string): value is MpScopeLevel {
  return MP_SCOPE_LEVELS.includes(value as MpScopeLevel);
}

export function isMpSessionMode(value: string): value is MpSessionMode {
  return MP_SESSION_MODES.includes(value as MpSessionMode);
}

export function isMpVisibilityState(value: string): value is MpVisibilityState {
  return MP_VISIBILITY_STATES.includes(value as MpVisibilityState);
}

export function isMpPromotionState(value: string): value is MpPromotionState {
  return MP_PROMOTION_STATES.includes(value as MpPromotionState);
}

export function canTransitionMpPromotionState(params: {
  from: MpPromotionState;
  to: MpPromotionState;
}): boolean {
  return MP_PROMOTION_STATE_TRANSITIONS[params.from].includes(params.to);
}

export function assertMpPromotionTransition(params: {
  from: MpPromotionState;
  to: MpPromotionState;
}): void {
  if (!canTransitionMpPromotionState(params)) {
    throw new Error(
      `MP promotion state cannot transition from ${params.from} to ${params.to}.`,
    );
  }
}

export function validateMpScopeDescriptor(scope: MpScopeDescriptor): void {
  assertNonEmpty(scope.projectId, "MP scope projectId");
  assertNonEmpty(scope.agentId, "MP scope agentId");
  if (scope.sessionId !== undefined) {
    assertNonEmpty(scope.sessionId, "MP scope sessionId");
  }
  if (!isMpScopeLevel(scope.scopeLevel)) {
    throw new Error(`Unsupported MP scope level: ${scope.scopeLevel}.`);
  }
  if (!isMpSessionMode(scope.sessionMode)) {
    throw new Error(`Unsupported MP session mode: ${scope.sessionMode}.`);
  }
  if (!isMpVisibilityState(scope.visibilityState)) {
    throw new Error(`Unsupported MP visibility state: ${scope.visibilityState}.`);
  }
  if (!isMpPromotionState(scope.promotionState)) {
    throw new Error(`Unsupported MP promotion state: ${scope.promotionState}.`);
  }

  const lineagePath = normalizeLineagePath(scope.lineagePath);
  if (scope.lineagePath && (!lineagePath || lineagePath.length === 0)) {
    throw new Error("MP scope lineagePath requires at least one non-empty lineage node.");
  }

  switch (scope.scopeLevel) {
    case "global":
      if (scope.sessionMode !== "shared") {
        throw new Error("MP global scope requires sessionMode=shared.");
      }
      if (
        scope.visibilityState !== "global_shared"
        && scope.visibilityState !== "archived"
      ) {
        throw new Error("MP global scope requires visibilityState=global_shared or archived.");
      }
      break;
    case "project":
      if (scope.sessionMode !== "shared") {
        throw new Error("MP project scope requires sessionMode=shared.");
      }
      if (
        scope.visibilityState !== "project_shared"
        && scope.visibilityState !== "archived"
      ) {
        throw new Error("MP project scope requires visibilityState=project_shared or archived.");
      }
      break;
    case "agent_isolated":
      if (scope.sessionMode === "shared") {
        throw new Error("MP agent_isolated scope does not allow sessionMode=shared.");
      }
      if (
        scope.sessionMode === "isolated"
        && scope.visibilityState !== "local_only"
        && scope.visibilityState !== "archived"
      ) {
        throw new Error("MP isolated agent scope requires visibilityState=local_only or archived.");
      }
      if (
        scope.sessionMode === "bridged"
        && scope.visibilityState !== "session_bridged"
        && scope.visibilityState !== "archived"
      ) {
        throw new Error("MP bridged agent scope requires visibilityState=session_bridged or archived.");
      }
      break;
  }
}

export function createMpScopeDescriptor(input: CreateMpScopeDescriptorInput): MpScopeDescriptor {
  const scopeLevel = input.scopeLevel ?? "agent_isolated";
  const sessionMode = input.sessionMode
    ?? (scopeLevel === "agent_isolated" ? "isolated" : "shared");
  const scope: MpScopeDescriptor = {
    projectId: assertNonEmpty(input.projectId, "MP scope projectId"),
    agentId: assertNonEmpty(input.agentId, "MP scope agentId"),
    sessionId: normalizeOptionalString(input.sessionId),
    scopeLevel,
    sessionMode,
    visibilityState: input.visibilityState ?? defaultVisibilityState({
      scopeLevel,
      sessionMode,
    }),
    promotionState: input.promotionState ?? defaultPromotionState(scopeLevel),
    lineagePath: normalizeLineagePath(input.lineagePath),
    metadata: input.metadata,
  };

  validateMpScopeDescriptor(scope);
  return scope;
}
