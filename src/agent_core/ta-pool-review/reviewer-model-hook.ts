import { executeTapAgentStructuredOutput, type TapAgentModelRoute } from "../integrations/tap-agent-model.js";
import type { ModelInferenceExecutionResult } from "../integrations/model-inference.js";
import {
  parseReviewerWorkerVoteOutput,
  REVIEWER_WORKER_BRIDGE_LANE,
  REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION,
} from "./reviewer-worker-bridge.js";
import type {
  ReviewerRuntimeHookInput,
  ReviewerRuntimeLlmHook,
} from "./reviewer-runtime.js";

type ModelExecutor = (params: { intent: import("../types/index.js").ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;

function createReviewerUserPrompt(input: ReviewerRuntimeHookInput): string {
  return [
    "Return one JSON object only.",
    "The object must match the reviewer worker output schema exactly.",
    `schemaVersion must be exactly ${REVIEWER_WORKER_OUTPUT_SCHEMA_VERSION}.`,
    `workerKind must be exactly reviewer.`,
    `lane must be exactly ${REVIEWER_WORKER_BRIDGE_LANE}.`,
    "Allowed votes: allow, allow_with_constraints, deny, defer, escalate_to_human, redirect_to_provisioning.",
    "Do not emit grants, decision tokens, execution requests, or any execution-bearing fields.",
    "Keep any recommended scope narrower than the original request.",
    "Optional explanation fields: humanSummary, userFacingExplanation, contextFindings, operatorNotes.",
    "",
    "Prompt pack:",
    JSON.stringify(input.promptPack, null, 2),
    "",
    "Worker envelope:",
    JSON.stringify(input.workerEnvelope, null, 2),
  ].join("\n");
}

export function createDefaultReviewerLlmHook(
  options: {
    executor: ModelExecutor;
    route?: Partial<TapAgentModelRoute>;
  },
): ReviewerRuntimeLlmHook {
  return async (input) => {
    return executeTapAgentStructuredOutput({
      executor: options.executor,
      sessionId: input.request.sessionId,
      runId: input.request.runId,
      workerKind: "tap-reviewer",
      route: options.route,
      systemPrompt: [
        input.promptPack.mission,
        ...input.promptPack.outputContract,
        `Forbidden actions: ${input.promptPack.forbiddenActions.join(", ")}.`,
      ].join(" "),
      userPrompt: createReviewerUserPrompt(input),
      parse: (jsonValue) => parseReviewerWorkerVoteOutput(jsonValue),
    });
  };
}
