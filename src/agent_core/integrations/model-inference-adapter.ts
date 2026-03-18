import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { GoalFrameCompiled, ModelInferenceIntent } from "../types/index.js";
import { executeModelInference, type ModelInferenceExecutionResult } from "./model-inference.js";

export const MODEL_INFERENCE_CAPABILITY_KEY = "model.infer";

interface ModelInferenceAdapterPlanInput {
  provider?: unknown;
  model?: unknown;
  frame?: unknown;
  stateSummary?: unknown;
  metadata?: unknown;
}

export interface ModelInferenceAdapterOptions {
  capabilityKey?: string;
  executor?: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parsePlanInput(plan: CapabilityInvocationPlan): {
  provider: string;
  model: string;
  frame: GoalFrameCompiled;
  stateSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
} {
  const input = plan.input as ModelInferenceAdapterPlanInput;
  const provider = asString(input.provider);
  const model = asString(input.model);
  const frame = input.frame as GoalFrameCompiled | undefined;

  if (!provider) {
    throw new Error("model.infer invocation is missing provider.");
  }
  if (!model) {
    throw new Error("model.infer invocation is missing model.");
  }
  if (!frame || typeof frame !== "object" || typeof frame.instructionText !== "string") {
    throw new Error("model.infer invocation is missing a valid compiled goal frame.");
  }

  return {
    provider,
    model,
    frame,
    stateSummary: asRecord(input.stateSummary),
    metadata: asRecord(input.metadata),
  };
}

export class ModelInferenceCapabilityAdapter implements CapabilityAdapter {
  readonly id: string;
  readonly runtimeKind = "model-inference";
  readonly #capabilityKey: string;
  readonly #executor: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  readonly #preparedInputs = new Map<string, ReturnType<typeof parsePlanInput>>();

  constructor(options: ModelInferenceAdapterOptions = {}) {
    this.#capabilityKey = options.capabilityKey ?? MODEL_INFERENCE_CAPABILITY_KEY;
    this.#executor = options.executor ?? executeModelInference;
    this.id = `adapter:${this.#capabilityKey}`;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== this.#capabilityKey) {
      return false;
    }

    try {
      parsePlanInput(plan);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const parsed = parsePlanInput(plan);
    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: "direct",
      preparedPayloadRef: `model-inference:${plan.planId}`,
      cacheKey: lease.preparedCacheKey ?? parsed.frame.cacheKey,
      metadata: {
        provider: parsed.provider,
        model: parsed.model,
        goalId: parsed.frame.goalId,
      },
    });

    this.#preparedInputs.set(prepared.preparedId, parsed);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const parsed = this.#preparedInputs.get(prepared.preparedId);
    if (!parsed) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "model_inference_prepared_input_missing",
          message: `Prepared model inference input for ${prepared.preparedId} was not found.`,
        },
        metadata: {
          capabilityKey: prepared.capabilityKey,
          runtimeKind: this.runtimeKind,
        },
      });
    }

    try {
      const result = await this.#executor({
        intent: {
          intentId: prepared.preparedId,
          sessionId: "session-adapter",
          runId: "run-adapter",
          kind: "model_inference",
          createdAt: new Date().toISOString(),
          priority: "normal",
          frame: parsed.frame,
          stateSummary: parsed.stateSummary,
          metadata: {
            provider: parsed.provider,
            model: parsed.model,
            ...(parsed.metadata ?? {}),
          },
        },
      });

      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: result.result.status,
        output: result.result.output,
        artifacts: result.result.artifacts,
        evidence: result.result.evidence,
        error: result.result.error,
        completedAt: result.result.emittedAt,
        metadata: {
          capabilityKey: prepared.capabilityKey,
          runtimeKind: this.runtimeKind,
          provider: parsed.provider,
          model: parsed.model,
          resultSource: "model",
          final: true,
        },
      });
    } catch (error) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "model_inference_execute_failed",
          message: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          capabilityKey: prepared.capabilityKey,
          runtimeKind: this.runtimeKind,
          provider: parsed.provider,
          model: parsed.model,
          resultSource: "model",
          final: true,
        },
      });
    }
  }
}

export function createModelInferenceCapabilityAdapter(
  options: ModelInferenceAdapterOptions = {},
): ModelInferenceCapabilityAdapter {
  return new ModelInferenceCapabilityAdapter(options);
}
