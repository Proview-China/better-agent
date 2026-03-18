import type {
  AccessRequest,
  AgentCapabilityProfile,
  ReviewDecision,
} from "../ta-pool-types/index.js";
import type { ReviewContextApertureSnapshot } from "../ta-pool-context/context-aperture.js";
import {
  createReviewContextApertureSnapshot,
} from "../ta-pool-context/context-aperture.js";
import type { ReviewRoutingResult } from "./review-routing.js";
import { routeAccessRequest } from "./review-routing.js";
import type {
  EvaluateReviewDecisionInput,
  ReviewDecisionEngineInventory,
} from "./review-decision-engine.js";
import { evaluateReviewDecision } from "./review-decision-engine.js";

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
}

export type ReviewerRuntimeLlmHook = (
  input: ReviewerRuntimeHookInput,
) => Promise<ReviewDecision | undefined>;

export interface ReviewerRuntimeOptions {
  llmReviewerHook?: ReviewerRuntimeLlmHook;
}

export class ReviewerRuntime {
  readonly #llmReviewerHook?: ReviewerRuntimeLlmHook;

  constructor(options: ReviewerRuntimeOptions = {}) {
    this.#llmReviewerHook = options.llmReviewerHook;
  }

  hasLlmReviewerHook(): boolean {
    return this.#llmReviewerHook !== undefined;
  }

  async submit(input: ReviewerRuntimeSubmitInput): Promise<ReviewDecision> {
    const reviewContext = input.reviewContext ?? createReviewContextApertureSnapshot({
      projectSummary: "ta-pool-reviewer-runtime",
      runSummary: `${input.request.sessionId}/${input.request.runId}`,
      profileSnapshot: input.profile,
      capabilityInventorySnapshot: {
        totalCapabilities: input.inventory?.availableCapabilityKeys?.length ?? 0,
        availableCapabilityKeys: input.inventory?.availableCapabilityKeys ?? [],
      },
      modeSnapshot: input.request.mode,
      metadata: {
        requestedCapabilityKey: input.request.requestedCapabilityKey,
      },
    });

    const routed = routeAccessRequest({
      profile: input.profile,
      request: input.request,
      capabilityAvailable: input.inventory?.availableCapabilityKeys?.includes(input.request.requestedCapabilityKey),
    });

    if (routed.outcome !== "review_required") {
      return routed.decision;
    }

    const fallback: EvaluateReviewDecisionInput = {
      request: input.request,
      profile: input.profile,
      inventory: input.inventory,
    };

    if (this.#llmReviewerHook) {
      const hookDecision = await this.#llmReviewerHook({
        request: input.request,
        profile: input.profile,
        inventory: input.inventory,
        reviewContext,
        routed,
        fallback,
      });
      if (hookDecision) {
        return hookDecision;
      }
    }

    return evaluateReviewDecision(fallback);
  }
}

export function createReviewerRuntime(options: ReviewerRuntimeOptions = {}): ReviewerRuntime {
  return new ReviewerRuntime(options);
}
