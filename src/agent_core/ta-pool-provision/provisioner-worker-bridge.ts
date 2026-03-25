import {
  createPoolActivationSpec,
  type CreatePoolActivationSpecInput,
  type ProvisionArtifactRef,
  type ProvisionRequest,
  type ReplayPolicy,
} from "../ta-pool-types/index.js";
import {
  TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS,
  TAP_EXTENDED_TMA_EXTRA_CAPABILITY_KEYS,
} from "../ta-pool-model/index.js";
import {
  createTapToolingCapabilityPackage,
  isTapToolingBaselineCapabilityKey,
} from "../capability-package/index.js";

export const PROVISIONER_WORKER_LANES = [
  "bootstrap",
  "extended",
] as const;
export type ProvisionerWorkerLane = (typeof PROVISIONER_WORKER_LANES)[number];

export const PROVISIONER_REPLAY_TRIGGERS = [
  "manual_only",
  "after_verify",
  "after_review",
] as const;
export type ProvisionerReplayTrigger = (typeof PROVISIONER_REPLAY_TRIGGERS)[number];

export interface ProvisionerLaneSemantics {
  lane: ProvisionerWorkerLane;
  description: string;
  allowedCapabilities: readonly string[];
  forbiddenCapabilities: readonly string[];
  allowedSideEffects: readonly string[];
  escalationBoundary: string;
}

export interface ProvisionerInventorySnapshot {
  availableCapabilityKeys: string[];
  pendingCapabilityKeys: string[];
  readyCapabilityKeys: string[];
  activeCapabilityKeys: string[];
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionerAllowedBuildScope {
  repoWriteRoots: string[];
  shellBudget: "restricted" | "extended";
  mayRunTests: boolean;
  mayGenerateDocs: boolean;
  mayInstallDependencies: boolean;
  mayConfigureMcp: boolean;
  mayUseNetwork: boolean;
  mayPerformSystemWrites: boolean;
}

export interface ProvisionerTargetCapabilitySpec {
  capabilityKey: string;
  requestedTier: ProvisionRequest["requestedTier"];
  reason: string;
  desiredProviderOrRuntime?: string;
  expectedArtifacts: string[];
  requiredVerification: string[];
  requestedReplayPolicy: ReplayPolicy;
}

export interface ProvisionerWorkerEnvelope {
  requestId: string;
  provisionId: string;
  targetCapabilitySpec: ProvisionerTargetCapabilitySpec;
  inventorySnapshot: ProvisionerInventorySnapshot;
  allowedBuildScope: ProvisionerAllowedBuildScope;
  allowedSideEffects: string[];
  existingSiblingCapabilities: string[];
  projectConstraints: string[];
  reviewerInstructions: string[];
}

export interface ProvisionerWorkerPromptPack {
  promptPackId: string;
  workerRole: "provisioner-worker";
  lane: ProvisionerWorkerLane;
  objective: string;
  systemPrompt: string;
  rules: string[];
  outputChecklist: string[];
  laneSemantics: ProvisionerLaneSemantics;
}

export interface ProvisionerReplayRecommendation {
  policy: ReplayPolicy;
  reason: string;
  requiresReviewerApproval: boolean;
  suggestedTrigger: ProvisionerReplayTrigger;
}

export interface ProvisionerWorkerOutput {
  workerAction: "build_capability_package";
  originalTaskDisposition: "left_for_main_agent";
  buildSummary: string;
  toolArtifact: ProvisionArtifactRef;
  bindingArtifact: ProvisionArtifactRef;
  verificationArtifact: ProvisionArtifactRef;
  usageArtifact: ProvisionArtifactRef;
  activationPayload: CreatePoolActivationSpecInput;
  replayRecommendation: ProvisionerReplayRecommendation;
  metadata?: Record<string, unknown>;
}

export interface ProvisionerWorkerBridgeInput {
  request: ProvisionRequest;
  lane: ProvisionerWorkerLane;
  promptPack: ProvisionerWorkerPromptPack;
  envelope: ProvisionerWorkerEnvelope;
}

export type ProvisionerWorkerBridge = (
  input: ProvisionerWorkerBridgeInput,
) => Promise<ProvisionerWorkerOutput>;

const BOOTSTRAP_LANE_SEMANTICS: ProvisionerLaneSemantics = {
  lane: "bootstrap",
  description: "Bootstrap provisioner may build repo-local packages, stage docs, and run bounded verification only.",
  allowedCapabilities: [...TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS],
  forbiddenCapabilities: [
    "dependency.install",
    "mcp.configure",
    "network.download",
    "system.write",
  ],
  allowedSideEffects: [
    "repo-local file edits",
    "bounded shell commands",
    "targeted tests",
    "skill/doc artifact generation",
  ],
  escalationBoundary: "Escalate before install, network download, MCP configuration, or system-level writes.",
};

const EXTENDED_LANE_SEMANTICS: ProvisionerLaneSemantics = {
  lane: "extended",
  description: "Extended provisioner may prepare heavier build plans, including install and system integration recommendations.",
  allowedCapabilities: [
    ...BOOTSTRAP_LANE_SEMANTICS.allowedCapabilities,
    ...TAP_EXTENDED_TMA_EXTRA_CAPABILITY_KEYS,
  ],
  forbiddenCapabilities: [
    "original_task.execute",
    "activation.auto_approve",
  ],
  allowedSideEffects: [
    ...BOOTSTRAP_LANE_SEMANTICS.allowedSideEffects,
    "dependency installation",
    "MCP configuration",
    "network downloads",
    "broader system preparation",
  ],
  escalationBoundary: "Extended lane still cannot approve activation or execute the user's original task.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const normalized = [...new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )];
  return normalized.length > 0 ? normalized : fallback;
}

function readMetadataRecord(request: ProvisionRequest): Record<string, unknown> {
  return isRecord(request.metadata) ? request.metadata : {};
}

function readLane(value: unknown): ProvisionerWorkerLane | undefined {
  return PROVISIONER_WORKER_LANES.includes(value as ProvisionerWorkerLane)
    ? value as ProvisionerWorkerLane
    : undefined;
}

function getLaneSemantics(lane: ProvisionerWorkerLane): ProvisionerLaneSemantics {
  return lane === "extended" ? EXTENDED_LANE_SEMANTICS : BOOTSTRAP_LANE_SEMANTICS;
}

function createProvisionerReplayRecommendation(
  policy: ReplayPolicy,
  lane: ProvisionerWorkerLane,
): ProvisionerReplayRecommendation {
  switch (policy) {
    case "none":
      return {
        policy,
        reason: "Package is staged only. Leave any follow-up dispatch to the main agent and operator.",
        requiresReviewerApproval: false,
        suggestedTrigger: "manual_only",
      };
    case "manual":
      return {
        policy,
        reason: "A human or main agent should manually decide whether and how to replay the blocked intent.",
        requiresReviewerApproval: true,
        suggestedTrigger: "manual_only",
      };
    case "auto_after_verify":
      return {
        policy,
        reason: lane === "extended"
          ? "Extended lane may recommend replay after verification, but activation still needs an external driver."
          : "Bootstrap lane can only recommend replay after verification; it cannot auto-execute the original task.",
        requiresReviewerApproval: lane !== "extended",
        suggestedTrigger: "after_verify",
      };
    case "re_review_then_dispatch":
    default:
      return {
        policy: "re_review_then_dispatch",
        reason: "Return the intent to reviewer/main-agent flow after verification so the package can be re-checked before dispatch.",
        requiresReviewerApproval: true,
        suggestedTrigger: "after_review",
      };
  }
}

function sanitizeCapabilityKey(capabilityKey: string): string {
  return capabilityKey.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function createDefaultInventorySnapshot(request: ProvisionRequest): ProvisionerInventorySnapshot {
  const metadata = readMetadataRecord(request);
  const inventoryMetadata = isRecord(metadata.inventorySnapshot)
    ? metadata.inventorySnapshot
    : {};

  const availableCapabilityKeys = normalizeStringArray(
    inventoryMetadata.availableCapabilityKeys,
  );
  const pendingCapabilityKeys = normalizeStringArray(
    inventoryMetadata.pendingCapabilityKeys,
  );
  const readyCapabilityKeys = normalizeStringArray(
    inventoryMetadata.readyCapabilityKeys,
  );
  const activeCapabilityKeys = normalizeStringArray(
    inventoryMetadata.activeCapabilityKeys,
  );

  return {
    availableCapabilityKeys,
    pendingCapabilityKeys,
    readyCapabilityKeys,
    activeCapabilityKeys,
    summary: typeof inventoryMetadata.summary === "string" && inventoryMetadata.summary.trim()
      ? inventoryMetadata.summary.trim()
      : `Inventory snapshot for ${request.requestedCapabilityKey} is partial; sibling capabilities are advisory only.`,
    metadata: Object.keys(inventoryMetadata).length > 0 ? inventoryMetadata : undefined,
  };
}

function createAllowedBuildScope(lane: ProvisionerWorkerLane): ProvisionerAllowedBuildScope {
  return lane === "extended"
    ? {
      repoWriteRoots: ["workspace/**"],
      shellBudget: "extended",
      mayRunTests: true,
      mayGenerateDocs: true,
      mayInstallDependencies: true,
      mayConfigureMcp: true,
      mayUseNetwork: true,
      mayPerformSystemWrites: true,
    }
    : {
      repoWriteRoots: ["workspace/**"],
      shellBudget: "restricted",
      mayRunTests: true,
      mayGenerateDocs: true,
      mayInstallDependencies: false,
      mayConfigureMcp: false,
      mayUseNetwork: false,
      mayPerformSystemWrites: false,
    };
}

export function resolveProvisionerWorkerLane(
  request: ProvisionRequest,
): ProvisionerWorkerLane {
  const metadata = readMetadataRecord(request);
  const approvedLane = readLane(metadata.approvedProvisionerLane);
  if (approvedLane) {
    return approvedLane;
  }

  return "bootstrap";
}

export function createProvisionerWorkerEnvelope(
  request: ProvisionRequest,
  lane = resolveProvisionerWorkerLane(request),
): ProvisionerWorkerEnvelope {
  const metadata = readMetadataRecord(request);
  const inventorySnapshot = createDefaultInventorySnapshot(request);
  const siblingCapabilities = normalizeStringArray(
    metadata.existingSiblingCapabilities,
    [...new Set([
      ...inventorySnapshot.availableCapabilityKeys,
      ...inventorySnapshot.readyCapabilityKeys,
      ...inventorySnapshot.activeCapabilityKeys,
    ])],
  );
  const projectConstraints = normalizeStringArray(metadata.projectConstraints, [
    "Build a capability package only; do not execute the user's original task.",
    "Do not approve activation from inside the provisioner lane.",
    lane === "bootstrap"
      ? "Bootstrap lane cannot install dependencies, configure MCP, or perform system writes."
      : "Extended lane may prepare install/config plans but still cannot approve activation.",
  ]);
  const reviewerInstructions = normalizeStringArray(metadata.reviewerInstructions, [
    "Provisioner may emit artifacts, activation payload, and replay recommendation only.",
    "Any real activation driver stays outside this worker bridge.",
    lane === "bootstrap"
      ? "Escalate to extended provisioner before any install/network/system step."
      : "Reviewer or higher policy must authorize any extended side effects before execution.",
  ]);

  return {
    requestId: request.sourceRequestId,
    provisionId: request.provisionId,
    targetCapabilitySpec: {
      capabilityKey: request.requestedCapabilityKey,
      requestedTier: request.requestedTier,
      reason: request.reason,
      desiredProviderOrRuntime: request.desiredProviderOrRuntime,
      expectedArtifacts: request.expectedArtifacts ?? [
        "tool",
        "binding",
        "verification",
        "usage",
      ],
      requiredVerification: request.requiredVerification ?? [
        "smoke",
        "health",
      ],
      requestedReplayPolicy: request.replayPolicy ?? "re_review_then_dispatch",
    },
    inventorySnapshot,
    allowedBuildScope: createAllowedBuildScope(lane),
    allowedSideEffects: [...getLaneSemantics(lane).allowedSideEffects],
    existingSiblingCapabilities: siblingCapabilities,
    projectConstraints,
    reviewerInstructions,
  };
}

export function createProvisionerWorkerPromptPack(
  request: ProvisionRequest,
  lane = resolveProvisionerWorkerLane(request),
): ProvisionerWorkerPromptPack {
  const semantics = getLaneSemantics(lane);
  return {
    promptPackId: `provisioner-worker:${lane}:v1`,
    workerRole: "provisioner-worker",
    lane,
    objective: `Build a reusable capability package for ${request.requestedCapabilityKey} without executing the user's original task.`,
    systemPrompt: [
      `You are the ${lane} provisioner worker for TAP.`,
      "Produce a capability package only.",
      "Do not approve activation yourself.",
      "Do not complete the blocked user task on behalf of the main agent.",
      "Always return structured artifacts plus activation and replay guidance.",
    ].join(" "),
    rules: [
      "Return tool, binding, verification, and usage artifacts.",
      "Include activation payload and replay recommendation in every ready output.",
      "Respect lane semantics and stay within allowed side effects.",
      "Prefer repo-local package construction over direct execution of the original request.",
      semantics.escalationBoundary,
    ],
    outputChecklist: [
      "tool artifact",
      "binding artifact",
      "verification artifact",
      "usage artifact",
      "build summary",
      "activation payload",
      "replay recommendation",
    ],
    laneSemantics: semantics,
  };
}

export function createProvisionerWorkerBridgeInput(
  request: ProvisionRequest,
): ProvisionerWorkerBridgeInput {
  const lane = resolveProvisionerWorkerLane(request);
  return {
    request,
    lane,
    promptPack: createProvisionerWorkerPromptPack(request, lane),
    envelope: createProvisionerWorkerEnvelope(request, lane),
  };
}

function createPackageSectionPayload(input: ProvisionerWorkerBridgeInput) {
  if (isTapToolingBaselineCapabilityKey(input.request.requestedCapabilityKey)) {
    const capabilityPackage = createTapToolingCapabilityPackage(
      input.request.requestedCapabilityKey,
    );
    return {
      capabilityPackage,
      manifest: capabilityPackage.manifest,
      adapter: capabilityPackage.adapter,
      policy: capabilityPackage.policy,
      builder: capabilityPackage.builder,
      lifecycle: capabilityPackage.lifecycle,
      verification: capabilityPackage.verification,
      usage: capabilityPackage.usage,
    };
  }

  const slug = sanitizeCapabilityKey(input.request.requestedCapabilityKey);
  const runtimeKind = input.request.desiredProviderOrRuntime?.trim() || "unspecified-runtime";
  return {
    manifest: {
      capabilityKey: input.request.requestedCapabilityKey,
      capabilityKind: "provisioned-capability",
      tier: input.request.requestedTier,
      version: "0.0.0-provisional",
      generation: `${input.request.provisionId}:${input.lane}`,
      description: `Provisioned capability package for ${input.request.requestedCapabilityKey}.`,
      dependencies: [],
      tags: [input.lane, "tap", "provisioner-worker-bridge"],
      routeHints: [runtimeKind],
      supportedPlatforms: ["linux", "macos", "windows"],
    },
    adapter: {
      adapterId: `adapter.${slug}`,
      runtimeKind,
      supports: [input.request.requestedCapabilityKey],
      prepare: "staged-by-provisioner-worker-bridge",
      execute: "delegated-to-main-agent-after-activation",
      cancel: "delegated-to-runtime-control-plane",
      resultMapping: "identity",
      adapterFactoryRef: `factory:${slug}`,
    },
    policy: {
      defaultBaseline: input.request.requestedTier,
      recommendedMode: "standard",
      riskLevel: "risky",
      defaultScope: "workspace package staging only",
      reviewRequirements: ["review-before-activation"],
      safetyFlags: [
        "no-direct-task-execution",
        "no-self-approval",
      ],
      humanGateRequirements: input.lane === "extended"
        ? ["extended-side-effects-require-approval"]
        : ["extended-lane-required-for-install-or-network"],
    },
    builder: {
      builderId: `builder.${slug}`,
      buildStrategy: input.lane === "extended" ? "extended-provisioner-worker-bridge" : "bootstrap-provisioner-worker-bridge",
      requiresNetwork: input.envelope.allowedBuildScope.mayUseNetwork,
      requiresInstall: input.envelope.allowedBuildScope.mayInstallDependencies,
      requiresSystemWrite: input.envelope.allowedBuildScope.mayPerformSystemWrites,
      allowedWorkdirScope: input.envelope.allowedBuildScope.repoWriteRoots,
      activationSpecRef: `activation:${input.request.provisionId}`,
      replayCapability: input.envelope.targetCapabilitySpec.requestedReplayPolicy,
    },
    lifecycle: {
      installStrategy: input.lane === "extended" ? "prepare_extended_install_plan" : "stage_only",
      replaceStrategy: "register_or_replace",
      rollbackStrategy: "reuse_previous_binding_when_available",
      deprecateStrategy: "mark_previous_generation_superseded",
      cleanupStrategy: "manual_cleanup_until_driver_exists",
      generationPolicy: "create_next_generation",
    },
    verification: {
      smokeEntry: `smoke:${slug}`,
      healthEntry: `health:${slug}`,
      successCriteria: [
        "tool artifact resolves",
        "binding artifact carries activation payload",
        "usage artifact explains invocation path",
      ],
      failureSignals: [
        "missing activation payload",
        "missing replay recommendation",
        "worker output attempts to execute original task",
      ],
      evidenceOutput: `evidence/${slug}.json`,
    },
    usage: {
      usageDocRef: `usage/${slug}.md`,
      skillRef: `skills/${slug}`,
      bestPractices: [
        "review before dispatch",
        "verify before activation",
      ],
      knownLimits: [
        "real activation driver not implemented yet",
        "builder payload is bridge-generated placeholder",
      ],
      exampleInvocations: [
        `request capability ${input.request.requestedCapabilityKey}`,
      ],
    },
  };
}

export function createDefaultProvisionerWorkerOutput(
  input: ProvisionerWorkerBridgeInput,
): ProvisionerWorkerOutput {
  const slug = sanitizeCapabilityKey(input.request.requestedCapabilityKey);
  const sections = createPackageSectionPayload(input);
  const capabilityPackage = "capabilityPackage" in sections
    ? sections.capabilityPackage
    : undefined;
  const genericAdapterFactoryRef = !capabilityPackage
    ? (sections as { adapter: { adapterFactoryRef: string } }).adapter.adapterFactoryRef
    : undefined;
  const replayRecommendation = createProvisionerReplayRecommendation(
    capabilityPackage?.replayPolicy ?? input.envelope.targetCapabilitySpec.requestedReplayPolicy,
    input.lane,
  );
  const toolArtifact: ProvisionArtifactRef = {
    artifactId: `${slug}:tool`,
    kind: "tool",
    ref: `provisioned/${slug}/tool.json`,
    metadata: {
      packageSections: [
        "manifest",
        "policy",
        "builder",
        "lifecycle",
      ],
      manifest: sections.manifest,
      policy: sections.policy,
      builder: sections.builder,
      lifecycle: sections.lifecycle,
      bridgeLane: input.lane,
      formalCapabilityPackage: !!capabilityPackage,
    },
  };
  const bindingArtifact: ProvisionArtifactRef = {
    artifactId: `${slug}:binding`,
    kind: "binding",
    ref: `provisioned/${slug}/binding.json`,
    metadata: {
      packageSections: ["adapter"],
      adapter: sections.adapter,
      bridgeLane: input.lane,
      activationDriverImplemented: !!capabilityPackage,
    },
  };
  const verificationArtifact: ProvisionArtifactRef = {
    artifactId: `${slug}:verification`,
    kind: "verification",
    ref: `provisioned/${slug}/verification.json`,
    metadata: {
      packageSections: ["verification"],
      verification: sections.verification,
      bridgeLane: input.lane,
      formalCapabilityPackage: !!capabilityPackage,
    },
  };
  const usageArtifact: ProvisionArtifactRef = {
    artifactId: `${slug}:usage`,
    kind: "usage",
    ref: `provisioned/${slug}/usage.md`,
    metadata: {
      packageSections: ["usage"],
      usage: sections.usage,
      bridgeLane: input.lane,
      formalCapabilityPackage: !!capabilityPackage,
    },
  };
  const activationPayload: CreatePoolActivationSpecInput = capabilityPackage?.activationSpec
    ? {
      ...capabilityPackage.activationSpec,
      manifestPayload: {
        ...capabilityPackage.activationSpec.manifestPayload,
        bridgeLane: input.lane,
      },
      bindingPayload: {
        ...capabilityPackage.activationSpec.bindingPayload,
        bindingArtifactRef: bindingArtifact.ref,
        verificationArtifactRef: verificationArtifact.ref,
        usageArtifactRef: usageArtifact.ref,
        bridgeLane: input.lane,
      },
      metadata: {
        ...(capabilityPackage.activationSpec.metadata ?? {}),
        formalCapabilityPackage: true,
      },
    }
    : {
      targetPool: "ta-capability-pool",
      activationMode: "stage_only",
      registerOrReplace: "register_or_replace",
      generationStrategy: "create_next_generation",
      drainStrategy: "graceful",
      manifestPayload: {
        ...sections.manifest,
        activationDriverImplemented: false,
      },
      bindingPayload: {
        adapterId: sections.adapter.adapterId,
        runtimeKind: sections.adapter.runtimeKind,
        bindingArtifactRef: bindingArtifact.ref,
        verificationArtifactRef: verificationArtifact.ref,
        usageArtifactRef: usageArtifact.ref,
        bridgeLane: input.lane,
      },
      adapterFactoryRef: genericAdapterFactoryRef!,
    };

  return {
    workerAction: "build_capability_package",
    originalTaskDisposition: "left_for_main_agent",
    buildSummary: [
      capabilityPackage
        ? `Built a formal bootstrap tooling capability package for ${input.request.requestedCapabilityKey}.`
        : `Built a staged capability package for ${input.request.requestedCapabilityKey}.`,
      `Lane: ${input.lane}.`,
      "This bridge returns package artifacts plus activation/replay guidance only.",
      capabilityPackage
        ? "Activation still needs the outer runtime, but the package contract is no longer placeholder-only."
        : "Real builder execution and activation driver remain unimplemented.",
    ].join(" "),
    toolArtifact,
    bindingArtifact,
    verificationArtifact,
    usageArtifact,
    activationPayload,
    replayRecommendation,
    metadata: {
      bridgeImplementation: "default-provisioner-worker-bridge",
      promptPackId: input.promptPack.promptPackId,
      lane: input.lane,
      packageTemplateStatus: capabilityPackage ? "formal" : "provisional",
      realBuilderImplemented: !!capabilityPackage,
      activationDriverImplemented: !!capabilityPackage,
      formalCapabilityPackage: !!capabilityPackage,
    },
  };
}

function validateArtifactRef(label: string, artifact: ProvisionArtifactRef): void {
  if (!artifact.artifactId.trim()) {
    throw new Error(`${label} requires a non-empty artifactId.`);
  }

  if (!artifact.kind.trim()) {
    throw new Error(`${label} requires a non-empty kind.`);
  }
}

export function validateProvisionerWorkerOutput(
  output: ProvisionerWorkerOutput,
): void {
  if (output.workerAction !== "build_capability_package") {
    throw new Error("Provisioner worker output must stay in build_capability_package mode.");
  }

  if (output.originalTaskDisposition !== "left_for_main_agent") {
    throw new Error("Provisioner worker output must leave the original task to the main agent.");
  }

  if (!output.buildSummary.trim()) {
    throw new Error("Provisioner worker output requires a non-empty build summary.");
  }

  validateArtifactRef("toolArtifact", output.toolArtifact);
  validateArtifactRef("bindingArtifact", output.bindingArtifact);
  validateArtifactRef("verificationArtifact", output.verificationArtifact);
  validateArtifactRef("usageArtifact", output.usageArtifact);

  createPoolActivationSpec(output.activationPayload);

  if (!output.replayRecommendation.reason.trim()) {
    throw new Error("Provisioner worker output requires a replay recommendation reason.");
  }

  if (!PROVISIONER_REPLAY_TRIGGERS.includes(output.replayRecommendation.suggestedTrigger)) {
    throw new Error(
      `Unsupported replay trigger: ${output.replayRecommendation.suggestedTrigger}.`,
    );
  }
}

export async function defaultProvisionerWorkerBridge(
  input: ProvisionerWorkerBridgeInput,
): Promise<ProvisionerWorkerOutput> {
  return createDefaultProvisionerWorkerOutput(input);
}
