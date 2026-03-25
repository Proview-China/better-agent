import type {
  CapabilityManifest,
  CapabilityRouteHint,
} from "../capability-types/index.js";
import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  type CapabilityPackage,
} from "./capability-package.js";

export const FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS = [
  "code.read",
  "docs.read",
] as const;
export type FirstClassToolingBaselineCapabilityKey =
  (typeof FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS)[number];

export const FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS = [
  "read_file",
  "read_lines",
  "list_dir",
  "stat_path",
] as const;
export type FirstClassToolingAllowedOperation =
  (typeof FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS)[number];

export interface FirstClassToolingCapabilityBaselineDescriptor {
  capabilityKey: FirstClassToolingBaselineCapabilityKey;
  scopeKind: "workspace-code" | "workspace-docs";
  scopeSummary: string;
  description: string;
  reviewerSummary: string;
  pathPatterns: string[];
  allowedOperations: FirstClassToolingAllowedOperation[];
  usageDocRef: string;
  examplePath: string;
  exampleOperation: FirstClassToolingAllowedOperation;
  routeHints: CapabilityRouteHint[];
  tags: string[];
  knownLimits: string[];
  workerConsumers: string[];
}

const FIRST_CLASS_TOOLING_BASELINE_DESCRIPTORS: Record<
  FirstClassToolingBaselineCapabilityKey,
  FirstClassToolingCapabilityBaselineDescriptor
> = {
  "code.read": {
    capabilityKey: "code.read",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source, config, and build-support files that a reviewer or planner may inspect safely.",
    description:
      "Read repo-local source and build files for TAP reviewer or TMA planning without introducing write side effects.",
    reviewerSummary:
      "Reviewer can inspect source and build context inside the repo, but cannot patch files or execute tasks through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "scripts",
      "scripts/**",
    ],
    allowedOperations: [...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src/agent_core/runtime.ts",
    exampleOperation: "read_lines",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
    ],
    tags: ["tap", "baseline", "read", "code", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it never writes or patches files.",
      "Scope stays inside repo-local code and build files only.",
      "Binary or oversized files may be truncated for safe context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "docs.read": {
    capabilityKey: "docs.read",
    scopeKind: "workspace-docs",
    scopeSummary:
      "Repo-local docs, markdown guidance, and project memory artifacts that ground reviewer decisions.",
    description:
      "Read repo-local docs, markdown guidance, and project memory artifacts for TAP reviewer or TMA planning.",
    reviewerSummary:
      "Reviewer can inspect docs and memory context inside the repo, but cannot edit docs or change project memory through this capability.",
    pathPatterns: [
      "docs",
      "docs/**",
      "README.md",
      "AGENTS.md",
      "*.md",
      "memory",
      "memory/**",
    ],
    allowedOperations: [...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS],
    usageDocRef:
      "docs/ability/tap-runtime-completion-task-pack/11-first-class-tooling-baseline-for-reviewer-and-tma.md",
    examplePath: "docs/ability/25-tap-capability-package-template.md",
    exampleOperation: "read_file",
    routeHints: [
      { key: "scope", value: "workspace-docs" },
      { key: "baseline", value: "reviewer-tma" },
    ],
    tags: ["tap", "baseline", "read", "docs", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it cannot edit docs or memory files.",
      "Scope stays inside repo-local documentation and markdown guidance.",
      "Binary or oversized files may be truncated for safe context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
};

export function getFirstClassToolingCapabilityBaselineDescriptor(
  capabilityKey: FirstClassToolingBaselineCapabilityKey,
): FirstClassToolingCapabilityBaselineDescriptor {
  const descriptor = FIRST_CLASS_TOOLING_BASELINE_DESCRIPTORS[capabilityKey];
  return {
    ...descriptor,
    pathPatterns: [...descriptor.pathPatterns],
    allowedOperations: [...descriptor.allowedOperations],
    routeHints: descriptor.routeHints.map((entry) => ({ ...entry })),
    tags: [...descriptor.tags],
    knownLimits: [...descriptor.knownLimits],
    workerConsumers: [...descriptor.workerConsumers],
  };
}

function createFirstClassToolingActivationSpec(
  descriptor: FirstClassToolingCapabilityBaselineDescriptor,
) {
  return {
    targetPool: "ta-capability-pool" as const,
    activationMode: "activate_immediately" as const,
    registerOrReplace: "register_or_replace" as const,
    generationStrategy: "reuse_current_generation" as const,
    drainStrategy: "graceful" as const,
    manifestPayload: {
      capabilityKey: descriptor.capabilityKey,
      kind: "tool",
      version: "1.0.0",
      generation: 1,
      description: descriptor.description,
      routeHints: descriptor.routeHints,
      tags: descriptor.tags,
      supportsPrepare: true,
    },
    bindingPayload: {
      capabilityKey: descriptor.capabilityKey,
      adapterId: `adapter:${descriptor.capabilityKey}`,
      runtimeKind: "workspace-read",
      allowedOperations: [...descriptor.allowedOperations],
      allowedPathPatterns: descriptor.pathPatterns,
    },
    adapterFactoryRef: `factory:${descriptor.capabilityKey}`,
  };
}

function createFirstClassToolingCapabilityPackage(
  capabilityKey: FirstClassToolingBaselineCapabilityKey,
): CapabilityPackage {
  const descriptor =
    getFirstClassToolingCapabilityBaselineDescriptor(capabilityKey);
  const activationSpec = createFirstClassToolingActivationSpec(descriptor);

  return createCapabilityPackage({
    manifest: {
      capabilityKey: descriptor.capabilityKey,
      capabilityKind: "tool",
      tier: "B0",
      version: "1.0.0",
      generation: 1,
      description: descriptor.description,
      dependencies: [],
      tags: descriptor.tags,
      routeHints: descriptor.routeHints,
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: {
        baseline: "first-class-tooling",
        baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
        scopeKind: descriptor.scopeKind,
        scopeSummary: descriptor.scopeSummary,
        reviewerSummary: descriptor.reviewerSummary,
        allowedOperations: [...descriptor.allowedOperations],
        pathPatterns: [...descriptor.pathPatterns],
        workerConsumers: [...descriptor.workerConsumers],
      },
    },
    adapter: {
      adapterId: `adapter:${descriptor.capabilityKey}`,
      runtimeKind: "workspace-read",
      supports: [...descriptor.allowedOperations],
      prepare: {
        ref: `adapter.prepare:${descriptor.capabilityKey}`,
        description:
          "Normalize read-only workspace access within the allowed baseline scope.",
      },
      execute: {
        ref: `adapter.execute:${descriptor.capabilityKey}`,
        description:
          "Read files or directories without mutating the workspace.",
      },
      resultMapping: {
        successStatuses: ["success", "partial"],
        artifactKinds: ["usage"],
      },
      metadata: {
        readOnly: true,
        scopeKind: descriptor.scopeKind,
        allowedOperations: [...descriptor.allowedOperations],
        pathPatterns: [...descriptor.pathPatterns],
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: "B0",
        mode: "standard",
        scope: {
          pathPatterns: descriptor.pathPatterns,
          allowedOperations: [...descriptor.allowedOperations],
        },
        metadata: {
          baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
          reviewerSummary: descriptor.reviewerSummary,
        },
      },
      recommendedMode: "standard",
      riskLevel: "normal",
      defaultScope: {
        pathPatterns: descriptor.pathPatterns,
        allowedOperations: [...descriptor.allowedOperations],
      },
      reviewRequirements: ["allow"],
      safetyFlags: ["read_only", "workspace_scoped"],
      humanGateRequirements: [],
      metadata: {
        reviewerReadable: true,
        scopeKind: descriptor.scopeKind,
        scopeSummary: descriptor.scopeSummary,
      },
    },
    builder: {
      builderId: `builder:${descriptor.capabilityKey}`,
      buildStrategy: "builtin-runtime-baseline",
      requiresNetwork: false,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: descriptor.pathPatterns,
      activationSpecRef:
        createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: "none",
      metadata: {
        readOnly: true,
        baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
      },
    },
    verification: {
      smokeEntry: `smoke:${descriptor.capabilityKey}`,
      healthEntry: `health:${descriptor.capabilityKey}`,
      successCriteria: [
        "Allowed file reads return stable content.",
        "Directory listings stay inside the declared scope.",
      ],
      failureSignals: [
        "Requested path escapes the workspace root.",
        "Requested path does not match the declared baseline scope.",
      ],
      evidenceOutput: ["read-summary", "path-scope-check"],
      metadata: {
        baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
        scopeSummary: descriptor.scopeSummary,
      },
    },
    usage: {
      usageDocRef: descriptor.usageDocRef,
      bestPractices: [
        "Use read_lines for focused snippets and read_file for full docs.",
        "Prefer docs.read for docs or markdown, and code.read for source or build files.",
      ],
      knownLimits: descriptor.knownLimits,
      exampleInvocations: [
        {
          exampleId: `${descriptor.capabilityKey}:example`,
          capabilityKey: descriptor.capabilityKey,
          operation: descriptor.exampleOperation,
          input: {
            path: descriptor.examplePath,
            ...(descriptor.exampleOperation === "read_lines"
              ? { lineStart: 1, lineEnd: 80 }
              : {}),
          },
        },
      ],
      metadata: {
        reviewerSummary: descriptor.reviewerSummary,
        scopeSummary: descriptor.scopeSummary,
      },
    },
    lifecycle: {
      installStrategy: "register built-in adapter at runtime startup",
      replaceStrategy:
        "register_or_replace the same capability key when the baseline evolves",
      rollbackStrategy:
        "restore the previous binding generation if a replacement regresses",
      deprecateStrategy: "remove from baseline helpers before unregistering",
      cleanupStrategy:
        "clear transient prepared-read state after dispatch completes",
      generationPolicy: "reuse_current_generation",
    },
    activationSpec,
    replayPolicy: "none",
    metadata: {
      baseline: "first-class-tooling",
    },
  });
}

export function createCodeReadCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.read");
}

export function createDocsReadCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("docs.read");
}

export function listFirstClassToolingBaselineCapabilityPackages(): CapabilityPackage[] {
  return FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS.map((capabilityKey) =>
    createFirstClassToolingCapabilityPackage(capabilityKey),
  );
}

export function listFirstClassToolingCapabilityBaselineDescriptors(): FirstClassToolingCapabilityBaselineDescriptor[] {
  return FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS.map((capabilityKey) =>
    getFirstClassToolingCapabilityBaselineDescriptor(capabilityKey),
  );
}

export function createCapabilityManifestFromPackage(
  capabilityPackage: CapabilityPackage,
): CapabilityManifest {
  return {
    capabilityId: `capability:${capabilityPackage.manifest.capabilityKey}:${capabilityPackage.manifest.generation}`,
    capabilityKey: capabilityPackage.manifest.capabilityKey,
    kind: capabilityPackage.manifest.capabilityKind,
    version: capabilityPackage.manifest.version,
    generation: capabilityPackage.manifest.generation,
    description: capabilityPackage.manifest.description,
    supportsPrepare: true,
    routeHints: capabilityPackage.manifest.routeHints,
    tags: capabilityPackage.manifest.tags,
    metadata: {
      supportedPlatforms: capabilityPackage.manifest.supportedPlatforms,
      packageTemplateVersion: capabilityPackage.templateVersion,
      ...(capabilityPackage.manifest.metadata ?? {}),
      ...(capabilityPackage.metadata ?? {}),
    },
  };
}
