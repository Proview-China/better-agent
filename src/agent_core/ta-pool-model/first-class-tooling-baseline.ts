import {
  FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS,
  type FirstClassToolingBaselineCapabilityKey,
} from "../capability-package/first-class-tooling-baseline.js";
import {
  createAgentCapabilityProfile,
  type AgentCapabilityProfile,
  type CreateAgentCapabilityProfileInput,
} from "../ta-pool-types/index.js";

export const FIRST_CLASS_TOOLING_BASELINE_CONSUMERS = [
  "reviewer",
  "bootstrap_tma",
  "extended_tma",
] as const;
export type FirstClassToolingBaselineConsumer =
  (typeof FIRST_CLASS_TOOLING_BASELINE_CONSUMERS)[number];

export interface FirstClassToolingBaselineDescriptor {
  consumer: FirstClassToolingBaselineConsumer;
  summary: string;
  reviewerSummary: string;
  capabilityKeys: string[];
  readOnly: boolean;
  mayProvision: boolean;
  mayPerformExternalSideEffects: boolean;
  escalationBoundary: string;
}

const FIRST_CLASS_TOOLING_BASELINE_DESCRIPTOR_MAP: Record<
  FirstClassToolingBaselineConsumer,
  FirstClassToolingBaselineDescriptor
> = {
  reviewer: {
    consumer: "reviewer",
    summary:
      "Reviewer baseline is read-only and exists to ground decisions with repo code and docs before any stronger capability is requested.",
    reviewerSummary:
      "Reviewer can only inspect repo code and docs through baseline reads; it cannot write, install, or execute user work.",
    capabilityKeys: [...FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS],
    readOnly: true,
    mayProvision: false,
    mayPerformExternalSideEffects: false,
    escalationBoundary:
      "Escalate before any write, shell execution, dependency install, MCP change, or network activity.",
  },
  bootstrap_tma: {
    consumer: "bootstrap_tma",
    summary:
      "Bootstrap TMA extends the reviewer read baseline with bounded repo-write, shell, test, and doc-generation support for package assembly.",
    reviewerSummary:
      "Bootstrap TMA can build and verify repo-local capability packages, but still should not install dependencies or touch external systems.",
    capabilityKeys: [
      ...FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS,
      "repo.write",
      "shell.restricted",
      "test.run",
      "skill.doc.generate",
    ],
    readOnly: false,
    mayProvision: true,
    mayPerformExternalSideEffects: false,
    escalationBoundary:
      "Escalate before dependency installation, MCP configuration, network download, or system-level writes.",
  },
  extended_tma: {
    consumer: "extended_tma",
    summary:
      "Extended TMA keeps the reviewer read baseline and bootstrap build tools, then adds install/configure/download powers for higher-externality provisioning work.",
    reviewerSummary:
      "Extended TMA may prepare heavier provisioning steps, but approval and original-task execution still live outside this baseline helper.",
    capabilityKeys: [
      ...FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS,
      "repo.write",
      "shell.restricted",
      "test.run",
      "skill.doc.generate",
      "dependency.install",
      "mcp.configure",
      "network.download",
    ],
    readOnly: false,
    mayProvision: true,
    mayPerformExternalSideEffects: true,
    escalationBoundary:
      "Extended TMA can recommend heavier setup work, but it still cannot auto-approve activation or execute the user's original task.",
  },
};

const FIRST_CLASS_TOOLING_BASELINE_BY_CONSUMER: Record<
  FirstClassToolingBaselineConsumer,
  readonly string[]
> = {
  reviewer: FIRST_CLASS_TOOLING_BASELINE_DESCRIPTOR_MAP.reviewer.capabilityKeys,
  bootstrap_tma:
    FIRST_CLASS_TOOLING_BASELINE_DESCRIPTOR_MAP.bootstrap_tma.capabilityKeys,
  extended_tma:
    FIRST_CLASS_TOOLING_BASELINE_DESCRIPTOR_MAP.extended_tma.capabilityKeys,
};

export const REVIEWER_FIRST_CLASS_BASELINE_CAPABILITIES: string[] = [
  ...FIRST_CLASS_TOOLING_BASELINE_BY_CONSUMER.reviewer,
];
export const TMA_BOOTSTRAP_FIRST_CLASS_BASELINE_CAPABILITIES: string[] = [
  ...FIRST_CLASS_TOOLING_BASELINE_BY_CONSUMER.bootstrap_tma,
];
export const TMA_EXTENDED_FIRST_CLASS_BASELINE_CAPABILITIES: string[] = [
  ...FIRST_CLASS_TOOLING_BASELINE_BY_CONSUMER.extended_tma,
];

export type FirstClassToolingBaselineKind = FirstClassToolingBaselineConsumer;
export interface CreateFirstClassToolingProfileInput extends CreateAgentCapabilityProfileInput {
  kind: FirstClassToolingBaselineKind;
}

function mergeCapabilityKeys(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function isFirstClassToolingBaselineCapability(
  capabilityKey: string,
): capabilityKey is FirstClassToolingBaselineCapabilityKey {
  return FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS.includes(
    capabilityKey as FirstClassToolingBaselineCapabilityKey,
  );
}

export function getFirstClassToolingBaselineCapabilities(
  consumer: FirstClassToolingBaselineConsumer,
): string[] {
  return [...FIRST_CLASS_TOOLING_BASELINE_BY_CONSUMER[consumer]];
}

export function getFirstClassToolingBaselineDescriptor(
  consumer: FirstClassToolingBaselineConsumer,
): FirstClassToolingBaselineDescriptor {
  const descriptor = FIRST_CLASS_TOOLING_BASELINE_DESCRIPTOR_MAP[consumer];
  return {
    ...descriptor,
    capabilityKeys: [...descriptor.capabilityKeys],
  };
}

export function listFirstClassToolingBaselineDescriptors(): FirstClassToolingBaselineDescriptor[] {
  return FIRST_CLASS_TOOLING_BASELINE_CONSUMERS.map((consumer) =>
    getFirstClassToolingBaselineDescriptor(consumer),
  );
}

export function listFirstClassToolingBaselineCapabilities(
  consumer: FirstClassToolingBaselineConsumer,
): string[] {
  return getFirstClassToolingBaselineCapabilities(consumer);
}

export function mergeFirstClassToolingBaselineCapabilities(params: {
  baselineCapabilities?: readonly string[];
  consumer: FirstClassToolingBaselineConsumer;
}): string[] {
  return mergeCapabilityKeys([
    ...(params.baselineCapabilities ?? []),
    ...getFirstClassToolingBaselineCapabilities(params.consumer),
  ]);
}

export function createProfileWithFirstClassToolingBaseline(
  input: CreateAgentCapabilityProfileInput,
  consumer: FirstClassToolingBaselineConsumer,
): AgentCapabilityProfile {
  return createAgentCapabilityProfile({
    ...input,
    baselineCapabilities: mergeFirstClassToolingBaselineCapabilities({
      baselineCapabilities: input.baselineCapabilities,
      consumer,
    }),
  });
}

export function createFirstClassToolingProfile(
  input: CreateFirstClassToolingProfileInput,
): AgentCapabilityProfile {
  return createProfileWithFirstClassToolingBaseline(input, input.kind);
}

export function extendProfileWithFirstClassToolingBaseline(
  profile: AgentCapabilityProfile,
  consumer: FirstClassToolingBaselineConsumer,
): AgentCapabilityProfile {
  return createAgentCapabilityProfile({
    profileId: profile.profileId,
    agentClass: profile.agentClass,
    defaultMode: profile.defaultMode,
    baselineTier: profile.baselineTier,
    baselineCapabilities: mergeFirstClassToolingBaselineCapabilities({
      baselineCapabilities: profile.baselineCapabilities,
      consumer,
    }),
    allowedCapabilityPatterns: profile.allowedCapabilityPatterns,
    deniedCapabilityPatterns: profile.deniedCapabilityPatterns,
    notes: profile.notes,
    metadata: profile.metadata,
  });
}
