import type {
  AccessRequest,
  AgentCapabilityProfile,
  ReviewDecision,
} from "../ta-pool-types/index.js";
import type { ReviewContextApertureSnapshot } from "../ta-pool-context/context-aperture.js";
import {
  createReviewContextApertureSnapshot,
} from "../ta-pool-context/context-aperture.js";
import { formatPlainLanguageRisk } from "../ta-pool-context/plain-language-risk.js";
import type { ReviewRoutingResult } from "./review-routing.js";
import { routeAccessRequest } from "./review-routing.js";
import type {
  EvaluateReviewDecisionInput,
  ReviewDecisionEngineInventory,
} from "./review-decision-engine.js";
import { evaluateReviewDecision } from "./review-decision-engine.js";
import {
  compileReviewerWorkerVote,
  createReviewerWorkerEnvelope,
  createReviewerWorkerPromptPack,
  type ReviewerWorkerVoteOutput,
} from "./reviewer-worker-bridge.js";
import {
  createReviewerDurableSnapshot,
  createReviewerDurableState,
  hydrateReviewerDurableSnapshot,
  type ReviewerDurableSnapshot,
  type ReviewerDurableSource,
  type ReviewerDurableState,
} from "./reviewer-durable-state.js";

export interface ReviewerRuntimeSubmitInput {
  request: AccessRequest;
  profile: AgentCapabilityProfile;
  inventory?: ReviewDecisionEngineInventory;
  reviewContext?: ReviewContextApertureSnapshot;
}

export interface ReviewerRuntimeHookInput {
  request: AccessRequest;
  profile: AgentCapabilityProfile;
  inventory?: ReviewDecisionEngineInventory;
  reviewContext: ReviewContextApertureSnapshot;
  routed: ReviewRoutingResult;
  fallback: EvaluateReviewDecisionInput;
  promptPack: ReturnType<typeof createReviewerWorkerPromptPack>;
  workerEnvelope: ReturnType<typeof createReviewerWorkerEnvelope>;
}

export type ReviewerRuntimeLlmHook = (
  input: ReviewerRuntimeHookInput,
) => Promise<ReviewerWorkerVoteOutput | undefined>;

export interface ReviewerRuntimeOptions {
  llmReviewerHook?: ReviewerRuntimeLlmHook;
  durableStateHook?: (state: ReviewerDurableState) => Promise<void> | void;
}

function normalizeStringArray(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function inventoryTracksCapabilityLifecycle(
  inventory: ReviewDecisionEngineInventory | undefined,
  capabilityKey: string,
): boolean {
  return [
    ...(inventory?.availableCapabilityKeys ?? []),
    ...(inventory?.pendingProvisionKeys ?? []),
    ...(inventory?.readyProvisionAssetKeys ?? []),
    ...(inventory?.activatingProvisionAssetKeys ?? []),
    ...(inventory?.activeProvisionAssetKeys ?? []),
  ].includes(capabilityKey);
}

function createDefaultProjectSummary(input: {
  request: AccessRequest;
  profile: AgentCapabilityProfile;
  inventory?: ReviewDecisionEngineInventory;
}): string {
  const available = normalizeStringArray([
    ...(input.inventory?.availableCapabilityKeys ?? []),
    ...(input.inventory?.readyProvisionAssetKeys ?? []),
    ...(input.inventory?.activatingProvisionAssetKeys ?? []),
    ...(input.inventory?.activeProvisionAssetKeys ?? []),
  ]).length;
  const pending = normalizeStringArray(input.inventory?.pendingProvisionKeys).length;
  return [
    `Reviewing ${input.request.requestedCapabilityKey} for ${input.request.sessionId}/${input.request.runId}.`,
    `Profile ${input.profile.profileId} is operating in ${input.request.mode} mode.`,
    `Inventory snapshot has ${available} known capability entries and ${pending} pending provisioning item(s).`,
  ].join(" ");
}

export class ReviewerRuntime {
  readonly #llmReviewerHook?: ReviewerRuntimeLlmHook;
  readonly #durableStateHook?: ReviewerRuntimeOptions["durableStateHook"];
  readonly #durableStates = new Map<string, ReviewerDurableState>();

  constructor(options: ReviewerRuntimeOptions = {}) {
    this.#llmReviewerHook = options.llmReviewerHook;
    this.#durableStateHook = options.durableStateHook;
  }

  hasLlmReviewerHook(): boolean {
    return this.#llmReviewerHook !== undefined;
  }

  getDurableState(requestId: string): ReviewerDurableState | undefined {
    return this.#durableStates.get(requestId);
  }

  listDurableStates(): readonly ReviewerDurableState[] {
    return [...this.#durableStates.values()];
  }

  exportDurableSnapshot(metadata?: Record<string, unknown>): ReviewerDurableSnapshot {
    return createReviewerDurableSnapshot(this.#durableStates.values(), metadata);
  }

  hydrateDurableSnapshot(snapshot: ReviewerDurableSnapshot | undefined): void {
    this.#durableStates.clear();
    for (const [requestId, state] of hydrateReviewerDurableSnapshot(snapshot)) {
      this.#durableStates.set(requestId, state);
    }
  }

  async #recordDurableState(
    request: AccessRequest,
    decision: ReviewDecision,
    source: ReviewerDurableSource,
  ): Promise<void> {
    const state = createReviewerDurableState({
      request,
      decision,
      source,
    });
    this.#durableStates.set(request.requestId, state);
    await this.#durableStateHook?.(state);
  }

  async recordDurableState(input: {
    request: AccessRequest;
    decision: ReviewDecision;
    source: ReviewerDurableSource;
  }): Promise<void> {
    await this.#recordDurableState(input.request, input.decision, input.source);
  }

  async submit(input: ReviewerRuntimeSubmitInput): Promise<ReviewDecision> {
    const requestedAction = input.request.requestedAction
      ?? `request capability ${input.request.requestedCapabilityKey}`;
    const plainLanguageRisk = input.request.plainLanguageRisk
      ?? formatPlainLanguageRisk({
        requestedAction,
        capabilityKey: input.request.requestedCapabilityKey,
        riskLevel: input.request.riskLevel ?? "normal",
      });
    const reviewContext = input.reviewContext ?? createReviewContextApertureSnapshot({
      projectSummary: {
        summary: createDefaultProjectSummary({
          request: input.request,
          profile: input.profile,
          inventory: input.inventory,
        }),
        status: "ready",
        source: "reviewer-runtime-default",
      },
      runSummary: {
        summary: `${input.request.sessionId}/${input.request.runId}`,
        status: "ready",
        source: "reviewer-runtime-default",
      },
      profileSnapshot: input.profile,
      inventorySnapshot: {
        totalCapabilities: normalizeStringArray([
          ...(input.inventory?.availableCapabilityKeys ?? []),
          ...(input.inventory?.readyProvisionAssetKeys ?? []),
          ...(input.inventory?.activatingProvisionAssetKeys ?? []),
          ...(input.inventory?.activeProvisionAssetKeys ?? []),
        ]).length,
        availableCapabilityKeys: input.inventory?.availableCapabilityKeys ?? [],
        pendingProvisionKeys: input.inventory?.pendingProvisionKeys,
        metadata: {
          readyProvisionAssetKeys: input.inventory?.readyProvisionAssetKeys ?? [],
          activatingProvisionAssetKeys: input.inventory?.activatingProvisionAssetKeys ?? [],
          activeProvisionAssetKeys: input.inventory?.activeProvisionAssetKeys ?? [],
        },
      },
      memorySummaryPlaceholder: {
        summary: "Memory summary is still placeholder-only in Wave 1 reviewer runtime.",
        status: "placeholder",
        source: "reviewer-runtime-default",
      },
      userIntentSummary: {
        summary: input.request.reason,
        status: "ready",
        source: "access-request",
      },
      riskSummary: {
        riskLevel: input.request.riskLevel ?? plainLanguageRisk.riskLevel,
        requestedAction,
        plainLanguageRisk,
        source: input.request.plainLanguageRisk ? "request" : "generated",
      },
      modeSnapshot: input.request.mode,
      metadata: {
        requestedCapabilityKey: input.request.requestedCapabilityKey,
      },
    });

    const routed = routeAccessRequest({
      profile: input.profile,
      request: input.request,
      capabilityAvailable: inventoryTracksCapabilityLifecycle(
        input.inventory,
        input.request.requestedCapabilityKey,
      ),
    });

    if (routed.outcome !== "review_required") {
      await this.#recordDurableState(input.request, routed.decision, "routing_fast_path");
      return routed.decision;
    }

    const fallback: EvaluateReviewDecisionInput = {
      request: input.request,
      profile: input.profile,
      inventory: input.inventory,
    };

    if (this.#llmReviewerHook) {
      const promptPack = createReviewerWorkerPromptPack();
      const workerEnvelope = createReviewerWorkerEnvelope({
        request: input.request,
        profile: input.profile,
        inventory: input.inventory,
        reviewContext,
        routed,
      });
      const hookDecision = await this.#llmReviewerHook({
        request: input.request,
        profile: input.profile,
        inventory: input.inventory,
        reviewContext,
        routed,
        fallback,
        promptPack,
        workerEnvelope,
      });
      if (hookDecision) {
        const decision = compileReviewerWorkerVote({
          request: input.request,
          promptPack,
          output: hookDecision,
        });
        await this.#recordDurableState(input.request, decision, "llm_hook");
        return decision;
      }
    }

    const decision = evaluateReviewDecision(fallback);
    await this.#recordDurableState(input.request, decision, "review_engine");
    return decision;
  }
}

export function createReviewerRuntime(options: ReviewerRuntimeOptions = {}): ReviewerRuntime {
  return new ReviewerRuntime(options);
}
