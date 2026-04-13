import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { GoalFrameCompiled, ModelInferenceIntent } from "../types/index.js";
import { renderGoalPromptBlocksInstructionText } from "../goal/goal-compiler.js";
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

export function createModelInferenceCapabilityManifest(
  capabilityKey = MODEL_INFERENCE_CAPABILITY_KEY,
): CapabilityManifest {
  return {
    capabilityId: `capability:${capabilityKey}`,
    capabilityKey,
    kind: "model",
    version: "1.0.0",
    generation: 1,
    description: "Execute compiled goal-frame model inference through the TAP capability plane.",
    supportsPrepare: true,
    supportsStreaming: false,
    supportsCancellation: false,
    hotPath: true,
    routeHints: [
      { key: "plane", value: "model" },
      { key: "dispatch", value: "tap" },
    ],
    tags: ["tap", "model", "core-agent"],
    metadata: {
      formalFamily: "model",
      resultSource: "model",
      final: true,
    },
  };
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

function normalizeCompiledGoalFrame(value: unknown): GoalFrameCompiled | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }

  const frame = value as GoalFrameCompiled;
  const instructionText = typeof frame.instructionText === "string"
    ? frame.instructionText
    : undefined;

  const promptBlocks = Array.isArray(frame.promptBlocks)
    ? frame.promptBlocks
        .filter(
          (block): block is NonNullable<GoalFrameCompiled["promptBlocks"]>[number] =>
            !!block
            && typeof block === "object"
            && typeof block.key === "string"
            && (!("title" in block) || typeof block.title === "string" || typeof block.title === "undefined")
            && Array.isArray(block.lines)
            && block.lines.every((line) => typeof line === "string")
        )
        .map((block) => ({
          ...block,
          lines: [...block.lines],
          metadata:
            block.metadata && typeof block.metadata === "object" && !Array.isArray(block.metadata)
              ? { ...block.metadata }
              : undefined,
        }))
    : undefined;

  const normalizedInstructionText = instructionText
    ?? (promptBlocks && promptBlocks.length > 0
      ? renderGoalPromptBlocksInstructionText(promptBlocks)
      : undefined);

  if (typeof frame.goalId !== "string" || !normalizedInstructionText) {
    return undefined;
  }

  return {
    ...frame,
    instructionText: normalizedInstructionText,
    promptBlocks,
  };
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
  const frame = normalizeCompiledGoalFrame(input.frame);

  if (!provider) {
    throw new Error("model.infer invocation is missing provider.");
  }
  if (!model) {
    throw new Error("model.infer invocation is missing model.");
  }
  if (!frame) {
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
