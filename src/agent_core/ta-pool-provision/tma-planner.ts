import {
  createTmaBuildPlan,
  type ProvisionRequest,
  type TmaBuildPlan,
} from "../ta-pool-types/index.js";
import {
  createTmaSessionState,
  type TmaSessionState,
} from "./tma-session-state.js";
import {
  createProvisionerWorkerBridgeInput,
  type ProvisionerWorkerBridgeInput,
  type ProvisionerWorkerEnvelope,
  type ProvisionerWorkerLane,
  type ProvisionerWorkerPromptPack,
} from "./provisioner-worker-bridge.js";

export interface TmaPlannerOutput {
  lane: ProvisionerWorkerLane;
  envelope: ProvisionerWorkerEnvelope;
  promptPack: ProvisionerWorkerPromptPack;
  buildPlan: TmaBuildPlan;
  sessionState: TmaSessionState;
}

function createImplementationSteps(
  input: ProvisionerWorkerBridgeInput,
): string[] {
  const steps: string[] = [
    `Inspect sibling capability inventory for ${input.request.requestedCapabilityKey}.`,
    `Prepare a reusable package plan for ${input.request.requestedCapabilityKey}.`,
  ];

  if (input.envelope.allowedBuildScope.mayInstallDependencies) {
    steps.push("Plan dependency installation and runtime prerequisites.");
  } else {
    steps.push("Keep the plan repo-local and avoid dependency or system installation.");
  }

  if (input.envelope.allowedBuildScope.mayConfigureMcp) {
    steps.push("Include MCP configuration work when the requested runtime requires it.");
  }

  if (input.envelope.allowedBuildScope.mayRunTests) {
    steps.push("Attach smoke or targeted verification steps to the package plan.");
  }

  steps.push("Generate usage and rollback guidance without executing the original user task.");
  return steps;
}

function createVerificationPlan(
  input: ProvisionerWorkerBridgeInput,
): string[] {
  const requested = input.envelope.targetCapabilitySpec.requiredVerification;
  if (requested.length > 0) {
    return requested.map((item) => `Run ${item} verification for ${input.request.requestedCapabilityKey}.`);
  }

  return [`Run smoke verification for ${input.request.requestedCapabilityKey}.`];
}

function createRollbackPlan(
  input: ProvisionerWorkerBridgeInput,
): string[] {
  const steps = [
    "Preserve or reference the previous binding before staging a replacement.",
    "Remove newly created package artifacts if verification fails.",
  ];

  if (input.envelope.allowedBuildScope.mayInstallDependencies) {
    steps.push("Undo dependency installation or runtime configuration if executor reports failure.");
  }

  return steps;
}

export function createTmaPlannerOutput(
  request: ProvisionRequest,
): TmaPlannerOutput {
  const bridgeInput = createProvisionerWorkerBridgeInput(request);
  const buildPlan = createTmaBuildPlan({
    planId: `plan:${request.provisionId}`,
    provisionId: request.provisionId,
    requestedCapabilityKey: request.requestedCapabilityKey,
    requestedLane: bridgeInput.lane,
    summary: `Plan how to build, verify, and hand off ${request.requestedCapabilityKey} without executing the blocked task.`,
    implementationSteps: createImplementationSteps(bridgeInput),
    expectedArtifacts: bridgeInput.envelope.targetCapabilitySpec.expectedArtifacts,
    verificationPlan: createVerificationPlan(bridgeInput),
    rollbackPlan: createRollbackPlan(bridgeInput),
    requiresApproval: bridgeInput.lane === "extended",
    createdAt: request.createdAt,
    metadata: {
      promptPackId: bridgeInput.promptPack.promptPackId,
      workerLane: bridgeInput.lane,
      inventorySummary: bridgeInput.envelope.inventorySnapshot.summary,
      reviewerInstructions: bridgeInput.envelope.reviewerInstructions,
      projectConstraints: bridgeInput.envelope.projectConstraints,
    },
  });
  const sessionState = createTmaSessionState({
    sessionId: `tma:${request.provisionId}:planner`,
    provisionId: request.provisionId,
    planId: buildPlan.planId,
    requestedCapabilityKey: request.requestedCapabilityKey,
    lane: buildPlan.requestedLane,
    phase: "planner",
    status: "resumable",
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
    resumeSummary: `Planner can resume ${request.requestedCapabilityKey} from the generated build plan without executing the original task.`,
    metadata: {
      promptPackId: bridgeInput.promptPack.promptPackId,
      workerLane: bridgeInput.lane,
    },
  });

  return {
    lane: bridgeInput.lane,
    envelope: bridgeInput.envelope,
    promptPack: bridgeInput.promptPack,
    buildPlan,
    sessionState,
  };
}
