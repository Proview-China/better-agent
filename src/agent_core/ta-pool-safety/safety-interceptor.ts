import {
  type TaCapabilityTier,
  type TaPoolMode,
} from "../ta-pool-types/ta-pool-profile.js";
import type { TaPoolRiskLevel } from "../ta-pool-types/ta-pool-review.js";
import {
  classifyCapabilityRisk,
  getModeRiskPolicyEntry,
  type TaCapabilityRiskClassifierConfig,
} from "../ta-pool-model/index.js";

export const TA_SAFETY_OUTCOMES = [
  "allow",
  "interrupt",
  "block",
  "downgrade",
  "escalate_to_human",
] as const;
export type TaSafetyOutcome = (typeof TA_SAFETY_OUTCOMES)[number];

export interface TaSafetyInterceptorConfig {
  riskyCapabilityPatterns?: string[];
  dangerousCapabilityPatterns?: string[];
  humanEscalationPatterns?: string[];
}

export interface TaSafetyInterceptionInput {
  mode: TaPoolMode;
  requestedTier: TaCapabilityTier;
  capabilityKey: string;
  riskLevel?: TaPoolRiskLevel;
  reason?: string;
  config?: TaSafetyInterceptorConfig;
}

export interface TaSafetyInterceptionResult {
  outcome: TaSafetyOutcome;
  reason: string;
  riskLevel?: TaPoolRiskLevel;
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

const DEFAULT_HUMAN_ESCALATION_PATTERNS = [
  "system.sudo",
  "workspace.outside.write",
  "workspace.outside.delete",
  "git.reset.hard",
  "computer.use.dangerous",
  "dangerous.*",
] as const;

function normalizePatterns(params: {
  defaults: readonly string[];
  overrides?: readonly string[];
}): string[] {
  const values = params.overrides ?? params.defaults;
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function firstMatch(capabilityKey: string, patterns: readonly string[]): string | undefined {
  return classifyCapabilityRisk({
    capabilityKey,
    config: {
      riskyCapabilityPatterns: patterns as string[],
      dangerousCapabilityPatterns: [],
    },
  }).matchedPattern;
}

function classifyInterceptionRisk(params: {
  capabilityKey: string;
  requestedTier: TaCapabilityTier;
  inputRiskLevel?: TaPoolRiskLevel;
  config?: TaSafetyInterceptorConfig;
}) {
  const classification = classifyCapabilityRisk({
    capabilityKey: params.capabilityKey,
    requestedTier: params.requestedTier,
    config: {
      riskyCapabilityPatterns: params.config?.riskyCapabilityPatterns,
      dangerousCapabilityPatterns: params.config?.dangerousCapabilityPatterns,
    } satisfies TaCapabilityRiskClassifierConfig,
  });

  if (params.inputRiskLevel) {
    return {
      ...classification,
      riskLevel: params.inputRiskLevel,
    };
  }

  return classification;
}

export function isDangerousCapabilityKey(params: {
  capabilityKey: string;
  requestedTier?: TaCapabilityTier;
  config?: TaSafetyInterceptorConfig;
}): { dangerous: boolean; matchedPattern?: string } {
  const classification = classifyInterceptionRisk({
    capabilityKey: params.capabilityKey,
    requestedTier: params.requestedTier ?? "B1",
    config: {
      riskyCapabilityPatterns: params.config?.riskyCapabilityPatterns,
      dangerousCapabilityPatterns: params.config?.dangerousCapabilityPatterns ?? [...DEFAULT_DANGEROUS_PATTERNS],
      humanEscalationPatterns: params.config?.humanEscalationPatterns,
    },
  });
  return {
    dangerous: classification.riskLevel === "dangerous",
    matchedPattern: classification.matchedPattern,
  };
}

export function shouldInterruptYoloRequest(params: {
  requestedTier: TaCapabilityTier;
  capabilityKey: string;
  riskLevel?: TaPoolRiskLevel;
  config?: TaSafetyInterceptorConfig;
}): { interrupt: boolean; matchedPattern?: string } {
  const classification = classifyInterceptionRisk({
    capabilityKey: params.capabilityKey,
    requestedTier: params.requestedTier,
    inputRiskLevel: params.riskLevel,
    config: {
      riskyCapabilityPatterns: params.config?.riskyCapabilityPatterns,
      dangerousCapabilityPatterns: params.config?.dangerousCapabilityPatterns ?? [...DEFAULT_DANGEROUS_PATTERNS],
      humanEscalationPatterns: params.config?.humanEscalationPatterns,
    },
  });
  return {
    interrupt: classification.riskLevel === "dangerous",
    matchedPattern: classification.matchedPattern,
  };
}

export function evaluateSafetyInterception(
  input: TaSafetyInterceptionInput,
): TaSafetyInterceptionResult {
  const classification = classifyInterceptionRisk({
    capabilityKey: input.capabilityKey,
    requestedTier: input.requestedTier,
    inputRiskLevel: input.riskLevel,
    config: {
      riskyCapabilityPatterns: input.config?.riskyCapabilityPatterns,
      dangerousCapabilityPatterns: input.config?.dangerousCapabilityPatterns ?? [...DEFAULT_DANGEROUS_PATTERNS],
      humanEscalationPatterns: input.config?.humanEscalationPatterns,
    },
  });
  const riskPolicy = getModeRiskPolicyEntry(input.mode, classification.riskLevel);
  const humanEscalationPatterns = normalizePatterns({
    defaults: DEFAULT_HUMAN_ESCALATION_PATTERNS,
    overrides: input.config?.humanEscalationPatterns,
  });
  const matchedHumanPattern = firstMatch(input.capabilityKey, humanEscalationPatterns);

  if (input.mode === "bapr") {
    return {
      outcome: "allow",
      riskLevel: classification.riskLevel,
      reason: `BAPR mode bypassed the safety interceptor for ${input.capabilityKey}.`,
      matchedPattern: classification.matchedPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
        riskReason: classification.reason,
      },
    };
  }

  if (input.mode === "yolo") {
    const interrupt = shouldInterruptYoloRequest({
      requestedTier: input.requestedTier,
      capabilityKey: input.capabilityKey,
      riskLevel: classification.riskLevel,
      config: input.config,
    });
    if (interrupt.interrupt) {
      return {
        outcome: "interrupt",
        riskLevel: classification.riskLevel,
        reason:
          classification.riskLevel === "dangerous"
            ? `Yolo mode interrupted dangerous capability ${input.capabilityKey}.`
            : `Yolo mode interrupted risky capability ${input.capabilityKey}.`,
        matchedPattern: interrupt.matchedPattern,
        metadata: {
          mode: input.mode,
          requestedTier: input.requestedTier,
          riskReason: classification.reason,
        },
      };
    }
    return {
      outcome: "allow",
      riskLevel: classification.riskLevel,
      reason: `Yolo mode allowed ${classification.riskLevel} capability ${input.capabilityKey}.`,
      matchedPattern: classification.matchedPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
        riskReason: classification.reason,
      },
    };
  }

  if (matchedHumanPattern) {
    return {
      outcome: "escalate_to_human",
      riskLevel: classification.riskLevel,
      reason: `Capability ${input.capabilityKey} requires human escalation before execution.`,
      matchedPattern: matchedHumanPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
        riskReason: classification.reason,
      },
    };
  }

  if (riskPolicy.decision === "human_gate") {
    if (riskPolicy.baselineFastPath && classification.riskLevel === "normal") {
      return {
        outcome: "allow",
        riskLevel: classification.riskLevel,
        reason: `Capability ${input.capabilityKey} keeps the baseline fast path in ${input.mode} mode.`,
        matchedPattern: classification.matchedPattern,
        metadata: {
          mode: input.mode,
          requestedTier: input.requestedTier,
          riskReason: classification.reason,
        },
      };
    }

    return {
      outcome: "escalate_to_human",
      riskLevel: classification.riskLevel,
      reason: `Capability ${input.capabilityKey} is ${classification.riskLevel} and requires human approval in ${input.mode} mode.`,
      matchedPattern: classification.matchedPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
        riskReason: classification.reason,
      },
    };
  }

  if (
    input.requestedTier === "B2"
    && classification.riskLevel === "risky"
    && input.capabilityKey.startsWith("shell.")
    && riskPolicy.decision === "review"
  ) {
    return {
      outcome: "downgrade",
      riskLevel: classification.riskLevel,
      reason: `Capability ${input.capabilityKey} should be narrowed before execution.`,
      downgradedTier: "B1",
      matchedPattern: classification.matchedPattern,
      metadata: {
        mode: input.mode,
        requestedTier: input.requestedTier,
        riskReason: classification.reason,
      },
    };
  }

  return {
    outcome: "allow",
    riskLevel: classification.riskLevel,
    reason: `Capability ${input.capabilityKey} did not trigger the safety interceptor.`,
    matchedPattern: classification.matchedPattern,
    metadata: {
      mode: input.mode,
      requestedTier: input.requestedTier,
      riskReason: classification.reason,
    },
  };
}
