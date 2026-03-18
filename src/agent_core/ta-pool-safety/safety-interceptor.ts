import {
  matchesCapabilityPattern,
  type TaCapabilityTier,
  type TaPoolMode,
} from "../ta-pool-types/index.js";

export const TA_SAFETY_OUTCOMES = [
  "allow",
  "interrupt",
  "block",
  "downgrade",
  "escalate_to_human",
] as const;
export type TaSafetyOutcome = (typeof TA_SAFETY_OUTCOMES)[number];

export interface TaSafetyInterceptorConfig {
  dangerousCapabilityPatterns?: string[];
  interruptOnlyPatterns?: string[];
  humanEscalationPatterns?: string[];
}

export interface TaSafetyInterceptionInput {
  mode: TaPoolMode;
  requestedTier: TaCapabilityTier;
  capabilityKey: string;
  reason?: string;
  config?: TaSafetyInterceptorConfig;
}

export interface TaSafetyInterceptionResult {
  outcome: TaSafetyOutcome;
  reason: string;
  matchedPattern?: string;
  downgradedTier?: TaCapabilityTier;
  metadata?: Record<string, unknown>;
}

const DEFAULT_DANGEROUS_PATTERNS = [
  "shell.rm*",
  "shell.delete*",
  "system.sudo",
  "git.reset.hard",
  "git.checkout.discard",
  "filesystem.delete.*",
  "workspace.outside.write",
  "workspace.outside.delete",
  "computer.use.dangerous",
] as const;

const DEFAULT_INTERRUPT_ONLY_PATTERNS = [
  "shell.*",
  "system.*",
  "computer.use*",
  "workspace.outside.*",
  "filesystem.delete.*",
  "git.reset.*",
  "git.checkout.discard",
  "sudo",
  "mcp.root.*",
  "mcp.browser.control",
  "mcp.playwright",
  "computer_use.*",
  "code.exec.*",
  "shell.exec",
  "shell.run",
  "delete.*",
  "rm.*",
  "dangerous.*",
] as const;

const DEFAULT_HUMAN_ESCALATION_PATTERNS = [
  "system.sudo",
  "workspace.outside.write",
  "workspace.outside.delete",
  "git.reset.hard",
  "computer.use.dangerous",
  "dangerous.*",
] as const;

function firstMatch(capabilityKey: string, patterns: readonly string[]): string | undefined {
  return patterns.find((pattern) =>
    matchesCapabilityPattern({
      capabilityKey,
      patterns: [pattern],
    })
  );
}

function normalizePatterns(params: {
  defaults: readonly string[];
  overrides?: readonly string[];
}): string[] {
  const values = params.overrides ?? params.defaults;
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function isDangerousCapabilityKey(params: {
  capabilityKey: string;
  config?: TaSafetyInterceptorConfig;
}): { dangerous: boolean; matchedPattern?: string } {
  const patterns = normalizePatterns({
    defaults: DEFAULT_DANGEROUS_PATTERNS,
    overrides: params.config?.dangerousCapabilityPatterns,
  });
  const matchedPattern = firstMatch(params.capabilityKey, patterns);
  return {
    dangerous: matchedPattern !== undefined,
    matchedPattern,
  };
}

export function shouldInterruptYoloRequest(params: {
  requestedTier: TaCapabilityTier;
  capabilityKey: string;
  config?: TaSafetyInterceptorConfig;
}): { interrupt: boolean; matchedPattern?: string } {
  const patterns = normalizePatterns({
    defaults: DEFAULT_INTERRUPT_ONLY_PATTERNS,
    overrides: params.config?.interruptOnlyPatterns,
  });
  const matchedPattern = firstMatch(params.capabilityKey, patterns);
  return {
    interrupt: params.requestedTier === "B3" || matchedPattern !== undefined,
    matchedPattern,
  };
}

export function evaluateSafetyInterception(
  input: TaSafetyInterceptionInput,
): TaSafetyInterceptionResult {
  const dangerous = isDangerousCapabilityKey({
    capabilityKey: input.capabilityKey,
    config: input.config,
  });
  const humanEscalationPatterns = normalizePatterns({
    defaults: DEFAULT_HUMAN_ESCALATION_PATTERNS,
    overrides: input.config?.humanEscalationPatterns,
  });
  const matchedHumanPattern = firstMatch(input.capabilityKey, humanEscalationPatterns);

  if (input.mode === "yolo") {
    const interrupt = shouldInterruptYoloRequest({
      requestedTier: input.requestedTier,
      capabilityKey: input.capabilityKey,
      config: input.config,
    });
    if (interrupt.interrupt) {
      return {
        outcome: "interrupt",
        reason:
          input.requestedTier === "B3"
            ? `Yolo mode interrupted critical capability ${input.capabilityKey}.`
            : `Yolo mode interrupted risky capability ${input.capabilityKey}.`,
        matchedPattern: interrupt.matchedPattern ?? dangerous.matchedPattern,
        metadata: {
          mode: input.mode,
          requestedTier: input.requestedTier,
        },
      };
    }
  }

  if (matchedHumanPattern || input.requestedTier === "B3") {
    return {
      outcome: "escalate_to_human",
      reason: `Capability ${input.capabilityKey} requires human escalation before execution.`,
      matchedPattern: matchedHumanPattern ?? dangerous.matchedPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
      },
    };
  }

  if (dangerous.dangerous) {
    return {
      outcome: "block",
      reason: `Capability ${input.capabilityKey} matched a dangerous safety pattern.`,
      matchedPattern: dangerous.matchedPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
      },
    };
  }

  if (input.requestedTier === "B2" && input.capabilityKey.startsWith("shell.")) {
    return {
      outcome: "downgrade",
      reason: `Capability ${input.capabilityKey} should be narrowed before execution.`,
      downgradedTier: "B1",
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
      },
    };
  }

  return {
    outcome: "allow",
    reason: `Capability ${input.capabilityKey} did not trigger the safety interceptor.`,
    metadata: {
      mode: input.mode,
      requestedTier: input.requestedTier,
    },
  };
}
