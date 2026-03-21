import type { PreparedInvocation } from "../../rax/contracts.js";
import type {
  McpCallInput,
  McpConnectInput,
  McpListToolsInput,
  McpNativePrepareResult,
  McpReadResourceInput,
} from "../../rax/mcp-types.js";
import type {
  SkillActivationPlan,
  SkillContainer,
} from "../../rax/skill-types.js";
import type { ProviderId, SdkLayer } from "../../rax/types.js";
import { createPoolActivationSpec } from "../ta-pool-types/index.js";

import type { CapabilityPackage } from "./capability-package.js";
import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
} from "./capability-package.js";

type RaxRouteContext = {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
};

type SharedMcpCapabilityKey =
  | "mcp.shared.call"
  | "mcp.shared.listTools"
  | "mcp.shared.readResource";

type SupportedMcpCapabilityKey =
  | SharedMcpCapabilityKey
  | "mcp.native.execute";

type SkillCapabilityKey =
  | "skill.use"
  | "skill.mount"
  | "skill.prepare";

type ComputerCapabilityKey =
  | "computer.use"
  | "computer.observe"
  | "computer.act";

type ComputerDispatchCapabilityKey =
  | "mcp.shared.call"
  | "mcp.native.execute";

type McpCapabilityInput =
  | McpCallInput
  | McpConnectInput
  | McpListToolsInput
  | McpReadResourceInput;

export interface CreateRaxMcpCapabilityPackageInput {
  capabilityKey: SupportedMcpCapabilityKey;
  route: RaxRouteContext;
  input: McpCapabilityInput;
  originalCapabilityKey?: string;
  nativePlan?: McpNativePrepareResult;
}

export interface CreateRaxSkillCapabilityPackageInput {
  capabilityKey: SkillCapabilityKey;
  route: RaxRouteContext;
  container: SkillContainer;
  invocation: PreparedInvocation<Record<string, unknown>>;
  activation?: SkillActivationPlan;
}

export interface CreateRaxComputerCapabilityPackageInput {
  capabilityKey: ComputerCapabilityKey;
  route: RaxRouteContext;
  input: McpCallInput;
  dispatchCapabilityKey?: ComputerDispatchCapabilityKey;
}

export interface CapabilityPackageSummary {
  templateVersion: string;
  capabilityKey: string;
  capabilityKind: CapabilityPackage["manifest"]["capabilityKind"];
  runtimeKind: string;
  builderId: string;
  replayPolicy: CapabilityPackage["replayPolicy"];
  activationSpecRef: string;
  lifecycle: CapabilityPackage["lifecycle"];
  routeHints: CapabilityPackage["manifest"]["routeHints"];
  usageDocRef: string;
  skillRef?: string;
  compatibilityAliases?: string[];
  entryFamily?: string;
  backingCapability?: string;
  carrierEntryFamilies?: string[];
  governance?: Record<string, unknown>;
  carrier?: Record<string, unknown>;
}

function normalizeLayer(layer?: SdkLayer): Exclude<SdkLayer, "auto"> {
  return layer === "api" || layer === "agent" ? layer : "agent";
}

function createPackageArtifacts(prefix: string) {
  return {
    toolArtifact: {
      artifactId: `${prefix}.tool`,
      kind: "tool",
      ref: `tool:${prefix}`,
    },
    bindingArtifact: {
      artifactId: `${prefix}.binding`,
      kind: "binding",
      ref: `binding:${prefix}`,
    },
    verificationArtifact: {
      artifactId: `${prefix}.verification`,
      kind: "verification",
      ref: `verification:${prefix}`,
    },
    usageArtifact: {
      artifactId: `${prefix}.usage`,
      kind: "usage",
      ref: `usage:${prefix}`,
    },
  };
}

function createRouteHints(route: RaxRouteContext, extra: Record<string, string | undefined> = {}) {
  const hints = [
    { key: "provider", value: route.provider },
    { key: "model", value: route.model },
    { key: "layer", value: normalizeLayer(route.layer) },
    { key: "variant", value: route.variant },
    { key: "compatibilityProfileId", value: route.compatibilityProfileId },
    ...Object.entries(extra).map(([key, value]) => ({ key, value })),
  ];

  return hints.filter((entry): entry is { key: string; value: string } => Boolean(entry.value));
}

function createActivationSpec(params: {
  capabilityKey: string;
  adapterId: string;
  runtimeKind: string;
  builderId: string;
  route: RaxRouteContext;
  metadata?: Record<string, unknown>;
}) {
  const layer = normalizeLayer(params.route.layer);
  return createPoolActivationSpec({
    targetPool: "ta-capability-pool",
    activationMode: "activate_after_verify",
    registerOrReplace: "register_or_replace",
    generationStrategy: "create_next_generation",
    drainStrategy: "graceful",
    manifestPayload: {
      capabilityKey: params.capabilityKey,
      provider: params.route.provider,
      model: params.route.model,
      layer,
    },
    bindingPayload: {
      adapterId: params.adapterId,
      runtimeKind: params.runtimeKind,
      provider: params.route.provider,
      layer,
    },
    adapterFactoryRef: `factory:${params.builderId}`,
    metadata: params.metadata,
  });
}

function mapSharedCapabilityKind(capabilityKey: SharedMcpCapabilityKey) {
  switch (capabilityKey) {
    case "mcp.shared.readResource":
      return "resource";
    case "mcp.shared.call":
    case "mcp.shared.listTools":
      return "tool";
  }
}

function buildSharedMcpLifecycle(capabilityKey: SharedMcpCapabilityKey, originalCapabilityKey?: string) {
  return {
    installStrategy: "Acquire or reuse a shared MCP connection before dispatch.",
    replaceStrategy: `Route ${capabilityKey} through the normalized mcp.shared.* entry family.`,
    rollbackStrategy: originalCapabilityKey && originalCapabilityKey !== capabilityKey
      ? `Temporarily fall back to compatibility alias ${originalCapabilityKey} while keeping the shared runtime session intact.`
      : "Restore the previous shared-runtime binding generation.",
    deprecateStrategy: "Keep legacy top-level mcp.* aliases compatibility-only and stop assigning them as the primary dispatch surface.",
    cleanupStrategy: "Disconnect drained shared MCP sessions after in-flight calls finish.",
    generationPolicy: "create_next_generation" as const,
  };
}

function buildSkillRiskLevel(container: SkillContainer) {
  switch (container.policy.riskLevel) {
    case "high":
      return "dangerous" as const;
    case "medium":
      return "risky" as const;
    default:
      return "normal" as const;
  }
}

function buildSkillCarrierMetadata(
  invocation: PreparedInvocation<Record<string, unknown>>,
  activation?: SkillActivationPlan,
) {
  return {
    officialCarrier: activation?.officialCarrier,
    sdkPackageName: invocation.sdk.packageName,
    entrypoint: invocation.sdk.entrypoint,
    adapterId: invocation.adapterId,
    mode: activation?.mode,
  };
}

function mapComputerCapabilityKind(capabilityKey: ComputerCapabilityKey) {
  switch (capabilityKey) {
    case "computer.observe":
      return "resource";
    case "computer.use":
    case "computer.act":
      return "runtime";
  }
}

function buildComputerAllowedOperations(capabilityKey: ComputerCapabilityKey) {
  return capabilityKey === "computer.observe"
    ? ["read"]
    : ["read", "exec"];
}

function buildComputerCarrierMetadata(
  dispatchCapabilityKey: ComputerDispatchCapabilityKey,
) {
  return {
    publicEntryFamily: "computer",
    backingCapability: dispatchCapabilityKey,
    carrierEntryFamilies: ["mcp.shared", "mcp.native"],
    carrierToolFamilies: ["browser", "desktop"],
    governance: {
      bridge: "ta.execution.bridge",
      metadataSlot: "taGrant.executionGovernance",
      activation: "existing TAP activation driver + capability package activationSpecRef",
    },
  };
}

export function createRaxMcpCapabilityPackage(
  input: CreateRaxMcpCapabilityPackageInput,
): CapabilityPackage {
  const layer = normalizeLayer(input.route.layer);
  const capabilityKey = input.capabilityKey;
  const builderId = capabilityKey === "mcp.native.execute"
    ? (input.nativePlan?.builderId ?? "rax.mcp.native.execute")
    : "rax.mcp.shared.runtime";
  const activationSpec = createActivationSpec({
    capabilityKey,
    adapterId: "rax.mcp.adapter",
    runtimeKind: "rax-mcp",
    builderId,
    route: input.route,
    metadata: capabilityKey === "mcp.native.execute" && input.nativePlan
      ? {
          officialCarrier: input.nativePlan.officialCarrier,
          loweringMode: input.nativePlan.loweringMode,
          carrierKind: input.nativePlan.carrierKind,
        }
      : {
          entryFamily: "mcp.shared",
        },
  });

  const compatibilityAliases =
    input.originalCapabilityKey && input.originalCapabilityKey !== capabilityKey
      ? [input.originalCapabilityKey]
      : [];

  if (capabilityKey === "mcp.native.execute") {
    const nativePlan = input.nativePlan;
    const providerCarrier = nativePlan
      ? {
          officialCarrier: nativePlan.officialCarrier,
          carrierKind: nativePlan.carrierKind,
          loweringMode: nativePlan.loweringMode,
          supportsResources: nativePlan.supportsResources,
          supportsPrompts: nativePlan.supportsPrompts,
          supportsServe: nativePlan.supportsServe,
          sdkPackageName: nativePlan.sdkPackageName,
          entrypoint: nativePlan.entrypoint,
        }
      : {
          carrierKind: "provider-native",
        };

    return createCapabilityPackage({
      manifest: {
        capabilityKey,
        capabilityKind: "runtime",
        tier: "B2",
        version: "1.0.0",
        generation: 1,
        description: "Provider-native MCP execution capability package aligned to the frozen mcp.native.* entry family.",
        dependencies: ["mcp.shared.connect"],
        tags: ["mcp", "native", input.route.provider, layer],
        routeHints: createRouteHints(input.route, {
          officialCarrier: nativePlan?.officialCarrier,
          loweringMode: nativePlan?.loweringMode,
        }),
        supportedPlatforms: ["linux", "macos", "windows"],
        metadata: providerCarrier,
      },
      adapter: {
        adapterId: "rax.mcp.adapter",
        runtimeKind: "rax-mcp",
        supports: [capabilityKey],
        prepare: { ref: "agent_core.integrations.rax-mcp-adapter.prepare" },
        execute: { ref: "agent_core.integrations.rax-mcp-adapter.execute" },
        resultMapping: {
          successStatuses: ["success", "partial"],
          artifactKinds: ["binding", "verification", "usage"],
          metadata: providerCarrier,
        },
      },
      policy: {
        defaultBaseline: {
          grantedTier: "B2",
          mode: "balanced",
          scope: {
            providerHints: [input.route.provider],
            allowedOperations: ["read", "exec"],
          },
        },
        recommendedMode: "standard",
        riskLevel: "risky",
        defaultScope: {
          providerHints: [input.route.provider],
          allowedOperations: ["read", "exec"],
        },
        reviewRequirements: ["allow_with_constraints"],
        safetyFlags: ["network_access", "provider_native_runtime"],
        humanGateRequirements: ["native_mcp_carrier_validation"],
      },
      builder: {
        builderId,
        buildStrategy: "provider-native-mcp-build-and-execute",
        requiresNetwork: true,
        requiresInstall: false,
        requiresSystemWrite: false,
        allowedWorkdirScope: ["workspace/**"],
        activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
        replayCapability: "re_review_then_dispatch",
        metadata: providerCarrier,
      },
      verification: {
        smokeEntry: "node --test src/agent_core/integrations/rax-mcp-adapter.test.ts",
        healthEntry: "node --test src/rax/mcp-runtime.test.ts",
        successCriteria: [
          "mcp.native.execute normalizes to the frozen public entry.",
          "Provider-native carrier metadata matches the prepared native plan.",
        ],
        failureSignals: [
          "native prepare returns unsupported",
          "native execute loses official carrier metadata",
        ],
        evidenceOutput: [
          "src/agent_core/integrations/rax-mcp-adapter.test.ts",
          "src/rax/mcp-runtime.test.ts",
        ],
      },
      usage: {
        usageDocRef: "docs/ability/13-mcp-official-alignment-roadmap.md",
        bestPractices: [
          "Inspect rax.mcp.native.prepare/build output before execute.",
          "Keep provider-native execution scoped to the official carrier advertised by the selected shell.",
        ],
        knownLimits: [
          "Provider-native carrier support still varies by provider, layer, and transport.",
          "Compatibility aliases are not the final public surface for native execution.",
        ],
        exampleInvocations: [
          {
            exampleId: "mcp.native.execute.default",
            capabilityKey,
            action: capabilityKey,
            input: {
              route: input.route,
              input: input.input,
            },
            notes: "Minimal provider-native MCP execution example.",
          },
        ],
        metadata: {
          carrier: providerCarrier,
        },
      },
      lifecycle: {
        installStrategy: "Prepare the official provider-native carrier plan via rax.mcp.native.prepare/build before dispatch.",
        replaceStrategy: "Stage the next native carrier generation and switch bindings after verification passes.",
        rollbackStrategy: "Restore the previous native carrier binding or shared-runtime fallback without changing frozen public keys.",
        deprecateStrategy: "Freeze old native carrier generations before retiring the underlying builder path.",
        cleanupStrategy: "Close drained native sessions and retire staged invocation artifacts after cutover.",
        generationPolicy: "create_next_generation",
      },
      activationSpec,
      replayPolicy: "re_review_then_dispatch",
      artifacts: createPackageArtifacts(capabilityKey.replace(/\./gu, "_")),
      metadata: {
        finalEntryFamily: "mcp.native",
        compatibilityAliases,
        carrier: providerCarrier,
      },
    });
  }

  return createCapabilityPackage({
    manifest: {
      capabilityKey,
      capabilityKind: mapSharedCapabilityKind(capabilityKey),
      tier: "B2",
      version: "1.0.0",
      generation: 1,
      description: "Shared MCP runtime capability package aligned to the frozen mcp.shared.* entry family.",
      dependencies: ["mcp.shared.connect"],
      tags: ["mcp", "shared", input.route.provider, layer],
      routeHints: createRouteHints(input.route, {
        entryFamily: "mcp.shared",
      }),
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: {
        entryFamily: "mcp.shared",
      },
    },
    adapter: {
      adapterId: "rax.mcp.adapter",
      runtimeKind: "rax-mcp",
      supports: [capabilityKey, ...compatibilityAliases],
      prepare: { ref: "agent_core.integrations.rax-mcp-adapter.prepare" },
      execute: { ref: "agent_core.integrations.rax-mcp-adapter.execute" },
      resultMapping: {
        successStatuses: ["success", "partial"],
        artifactKinds: ["verification", "usage"],
        metadata: {
          compatibilityAliases,
        },
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: "B2",
        mode: "balanced",
        scope: {
          providerHints: [input.route.provider],
          allowedOperations: ["read"],
        },
      },
      recommendedMode: "standard",
      riskLevel: capabilityKey === "mcp.shared.call" ? "risky" : "normal",
      defaultScope: {
        providerHints: [input.route.provider],
        allowedOperations: ["read"],
      },
      reviewRequirements: capabilityKey === "mcp.shared.call"
        ? ["allow_with_constraints"]
        : ["allow"],
      safetyFlags: capabilityKey === "mcp.shared.call"
        ? ["shared_runtime_connection"]
        : [],
      humanGateRequirements: [],
    },
    builder: {
      builderId,
      buildStrategy: "shared-mcp-runtime-dispatch",
      requiresNetwork: false,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: ["workspace/**"],
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: "re_review_then_dispatch",
      metadata: {
        compatibilityAliases,
      },
    },
    verification: {
      smokeEntry: "node --test src/agent_core/integrations/rax-mcp-adapter.test.ts",
      healthEntry: "node --test src/rax/mcp-runtime.test.ts",
      successCriteria: [
        "Shared MCP dispatch lands on mcp.shared.* as the final public entry.",
        "Compatibility aliases remain metadata-only and do not become the primary execution target.",
      ],
      failureSignals: [
        "adapter still routes through top-level mcp.* compatibility methods",
        "shared MCP metadata loses normalized capability key",
      ],
      evidenceOutput: [
        "src/agent_core/integrations/rax-mcp-adapter.test.ts",
        "src/rax/mcp-runtime.test.ts",
      ],
    },
    usage: {
      usageDocRef: "docs/ability/13-mcp-official-alignment-roadmap.md",
      bestPractices: [
        "Use mcp.shared.* as the frozen public entry and keep top-level mcp.* compatibility-only.",
        "Carry provider/model/layer route context through every shared MCP call.",
      ],
      knownLimits: [
        "Shared MCP runtime still owns connection lifecycle; it does not become the provider-native carrier.",
        "Legacy top-level aliases may remain for compatibility, but they are not the final public surface.",
      ],
      exampleInvocations: [
        {
          exampleId: `${capabilityKey}.default`,
          capabilityKey,
          action: capabilityKey,
          input: {
            route: input.route,
            input: input.input,
          },
          notes: compatibilityAliases.length > 0
            ? `Legacy alias ${compatibilityAliases[0]} remains compatibility-only.`
            : "Minimal shared MCP runtime example.",
        },
      ],
      metadata: {
        compatibilityAliases,
      },
    },
    lifecycle: buildSharedMcpLifecycle(capabilityKey, input.originalCapabilityKey),
    activationSpec,
    replayPolicy: "re_review_then_dispatch",
    artifacts: createPackageArtifacts(capabilityKey.replace(/\./gu, "_")),
    metadata: {
      finalEntryFamily: "mcp.shared",
      compatibilityAliases,
    },
  });
}

export function createRaxSkillCapabilityPackage(
  input: CreateRaxSkillCapabilityPackageInput,
): CapabilityPackage {
  const layer = normalizeLayer(input.route.layer);
  const builderId = input.invocation.adapterId;
  const activationSpec = createActivationSpec({
    capabilityKey: input.capabilityKey,
    adapterId: "rax.skill.adapter",
    runtimeKind: "rax-skill",
    builderId,
    route: input.route,
    metadata: buildSkillCarrierMetadata(input.invocation, input.activation),
  });
  const skillScope = [`${input.container.source.rootDir}/**`];
  const carrierMetadata = buildSkillCarrierMetadata(input.invocation, input.activation);

  return createCapabilityPackage({
    manifest: {
      capabilityKey: input.capabilityKey,
      capabilityKind: "runtime",
      tier: "B2",
      version: input.container.descriptor.version ?? "1.0.0",
      generation: Math.max(input.container.ledger.activationCount, 1),
      description: `Skill capability package for ${input.container.descriptor.name}.`,
      dependencies: [input.container.descriptor.id],
      tags: [
        "skill",
        input.route.provider,
        layer,
        ...input.container.descriptor.tags,
      ],
      routeHints: createRouteHints(input.route, {
        officialCarrier: input.activation?.officialCarrier,
        mode: input.activation?.mode,
      }),
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: {
        containerId: input.container.descriptor.id,
        carrier: carrierMetadata,
      },
    },
    adapter: {
      adapterId: "rax.skill.adapter",
      runtimeKind: "rax-skill",
      supports: [input.capabilityKey],
      prepare: { ref: "agent_core.integrations.rax-skill-adapter.prepare" },
      execute: { ref: "agent_core.integrations.rax-skill-adapter.execute" },
      resultMapping: {
        successStatuses: ["success"],
        artifactKinds: ["binding", "verification", "usage"],
        metadata: carrierMetadata,
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: "B2",
        mode: "balanced",
        scope: {
          pathPatterns: skillScope,
          allowedOperations: ["read"],
          providerHints: [input.route.provider],
        },
      },
      recommendedMode: "standard",
      riskLevel: buildSkillRiskLevel(input.container),
      defaultScope: {
        pathPatterns: skillScope,
        allowedOperations: ["read"],
        providerHints: [input.route.provider],
      },
      reviewRequirements: input.container.policy.requiresApproval
        ? ["escalate_to_human"]
        : ["allow"],
      safetyFlags: input.container.policy.requiresApproval
        ? ["skill_requires_approval"]
        : [],
      humanGateRequirements: input.container.policy.requiresApproval
        ? ["explicit_skill_approval"]
        : [],
    },
    builder: {
      builderId,
      buildStrategy: "bind-and-prepare-skill-carrier",
      requiresNetwork: input.activation?.mode === "openai-hosted-shell" || input.activation?.mode === "anthropic-api-managed",
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: skillScope,
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: "re_review_then_dispatch",
      metadata: carrierMetadata,
    },
    verification: {
      smokeEntry: "node --test src/agent_core/integrations/rax-skill-adapter.test.ts",
      healthEntry: "node --test src/rax/skill-runtime.test.ts",
      successCriteria: [
        "Skill runtime binds the container to the expected official carrier.",
        "Prepared invocation stays aligned with the frozen skill action entry.",
      ],
      failureSignals: [
        "skill carrier metadata drifts from the prepared invocation",
        "skill capability package loses its container or lifecycle mapping",
      ],
      evidenceOutput: [
        "src/agent_core/integrations/rax-skill-adapter.test.ts",
        "src/rax/skill-runtime.test.ts",
        "src/rax/skill-capability-report.test.ts",
      ],
    },
    usage: {
      usageDocRef: "docs/ability/09-skill-cross-sdk-research.md",
      skillRef: input.container.descriptor.id,
      bestPractices: [
        "Treat the skill as a bundle plus binding, not as a single tool call.",
        "Use the provider-specific official carrier metadata when deciding how to mount or prepare the skill.",
      ],
      knownLimits: [
        "Provider skill carriers do not expose identical lifecycle surfaces.",
        "This package only freezes issue-10 scope and does not define global governance semantics.",
      ],
      exampleInvocations: [
        {
          exampleId: `${input.capabilityKey}.${input.container.descriptor.id}`,
          capabilityKey: input.capabilityKey,
          action: input.capabilityKey,
          input: {
            route: input.route,
            container: {
              id: input.container.descriptor.id,
              rootDir: input.container.source.rootDir,
              entryPath: input.container.source.entryPath,
            },
          },
          notes: `Routes ${input.container.descriptor.name} through ${input.activation?.officialCarrier ?? "its prepared carrier"}.`,
        },
      ],
      metadata: {
        carrier: carrierMetadata,
      },
    },
    lifecycle: {
      installStrategy: `Bind the skill bundle to ${input.activation?.officialCarrier ?? "the prepared skill carrier"} before dispatch.`,
      replaceStrategy: "Stage the next bound skill generation and swap carrier attachments after verification.",
      rollbackStrategy: `Restore the previous skill binding or attachment for ${input.container.descriptor.id}.`,
      deprecateStrategy: "Stop routing new skill activations to the deprecated carrier before removal.",
      cleanupStrategy: "Remove drained temporary skill artifacts after the replacement generation is stable.",
      generationPolicy: "create_next_generation",
    },
    activationSpec,
    replayPolicy: "re_review_then_dispatch",
    artifacts: createPackageArtifacts(input.capabilityKey.replace(/\./gu, "_")),
    metadata: {
      carrier: carrierMetadata,
    },
  });
}

export function createRaxComputerCapabilityPackage(
  input: CreateRaxComputerCapabilityPackageInput,
): CapabilityPackage {
  const layer = normalizeLayer(input.route.layer);
  const dispatchCapabilityKey = input.dispatchCapabilityKey ?? "mcp.shared.call";
  const carrierMetadata = buildComputerCarrierMetadata(dispatchCapabilityKey);
  const activationSpec = createActivationSpec({
    capabilityKey: input.capabilityKey,
    adapterId: "rax.mcp.adapter",
    runtimeKind: "rax-mcp",
    builderId: "rax.computer.browser.desktop",
    route: input.route,
    metadata: carrierMetadata,
  });

  return createCapabilityPackage({
    manifest: {
      capabilityKey: input.capabilityKey,
      capabilityKind: mapComputerCapabilityKind(input.capabilityKey),
      tier: "B2",
      version: "1.0.0",
      generation: 1,
      description: "Computer/browser/desktop capability line that reuses the existing MCP bridge and execution governance seam.",
      dependencies: [dispatchCapabilityKey],
      tags: ["computer", "browser", "desktop", input.route.provider, layer],
      routeHints: createRouteHints(input.route, {
        publicEntryFamily: "computer",
        backingCapability: dispatchCapabilityKey,
      }),
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: carrierMetadata,
    },
    adapter: {
      adapterId: "rax.mcp.adapter",
      runtimeKind: "rax-mcp",
      supports: [input.capabilityKey],
      prepare: { ref: "agent_core.integrations.rax-mcp-adapter.prepare" },
      execute: { ref: "agent_core.integrations.rax-mcp-adapter.execute" },
      resultMapping: {
        successStatuses: ["success", "partial"],
        artifactKinds: ["verification", "usage"],
        metadata: carrierMetadata,
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: "B2",
        mode: "balanced",
        scope: {
          providerHints: [input.route.provider],
          allowedOperations: buildComputerAllowedOperations(input.capabilityKey),
        },
      },
      recommendedMode: "standard",
      riskLevel: input.capabilityKey === "computer.observe" ? "normal" : "risky",
      defaultScope: {
        providerHints: [input.route.provider],
        allowedOperations: buildComputerAllowedOperations(input.capabilityKey),
      },
      reviewRequirements: input.capabilityKey === "computer.observe"
        ? ["allow"]
        : ["allow_with_constraints"],
      safetyFlags: input.capabilityKey === "computer.observe"
        ? ["computer_surface"]
        : ["computer_surface", "browser_side_effects"],
      humanGateRequirements: [],
    },
    builder: {
      builderId: "rax.computer.browser.desktop",
      buildStrategy: "route-computer-capability-through-existing-mcp-bridge",
      requiresNetwork: false,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: ["workspace/**"],
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: "re_review_then_dispatch",
      metadata: carrierMetadata,
    },
    verification: {
      smokeEntry: "node --test src/agent_core/integrations/rax-mcp-adapter.test.ts",
      healthEntry: "node --test src/rax/mcp-runtime.test.ts",
      successCriteria: [
        "computer.* stays as the formal public capability line for browser/desktop work.",
        `Dispatch lowers through ${dispatchCapabilityKey} without replacing the public capability key.`,
        "MCP carrier families remain behind mcp.shared.* / mcp.native.* instead of becoming the computer public surface.",
      ],
      failureSignals: [
        "computer.* collapses into compatibility-only metadata",
        "dispatch bypasses the existing MCP bridge or TAP execution governance seam",
      ],
      evidenceOutput: [
        "src/agent_core/integrations/rax-mcp-adapter.test.ts",
        "src/rax/mcp-runtime.test.ts",
        "src/rax/mcp-playwright-smoke.ts",
        "src/rax/mcp-native-live-smoke.ts",
      ],
    },
    usage: {
      usageDocRef: "docs/ability/25-tap-capability-package-template.md",
      bestPractices: [
        "Keep computer.* as the public capability contract and leave browser_* / desktop_* names inside the underlying MCP carrier.",
        "Lower through the existing ta execution bridge so grant executionGovernance metadata stays attached.",
        "Treat mcp.native.execute as a carrier path for provider-native composition, not as the end-user computer capability key.",
      ],
      knownLimits: [
        "The minimal issue-14 closure still executes through the existing rax.mcp adapter rather than a new runtime.",
        "Browser/desktop tool names remain carrier-level MCP details and may vary by server implementation.",
        "This package does not redefine approval, session, or lifecycle semantics beyond the current TAP governance seam.",
      ],
      exampleInvocations: [
        {
          exampleId: `${input.capabilityKey}.default`,
          capabilityKey: input.capabilityKey,
          action: input.capabilityKey,
          input: {
            route: input.route,
            input: input.input,
            dispatchCapabilityKey,
          },
          notes: `Public computer capability backed by ${dispatchCapabilityKey}.`,
        },
      ],
      metadata: carrierMetadata,
    },
    lifecycle: {
      installStrategy: "Register the computer capability through the existing TAP activation driver and bind it to the current MCP adapter generation.",
      replaceStrategy: "Stage the next computer capability generation, verify it against MCP smoke coverage, then flip the active binding.",
      rollbackStrategy: "Restore the previous computer capability binding without changing the frozen mcp.shared.* / mcp.native.* carrier entries.",
      deprecateStrategy: "Deprecate old browser/desktop computer generations after the replacement binding is active and verified.",
      cleanupStrategy: "Drain obsolete computer capability bindings after in-flight browser sessions finish.",
      generationPolicy: "create_next_generation",
    },
    activationSpec,
    replayPolicy: "re_review_then_dispatch",
    artifacts: createPackageArtifacts(input.capabilityKey.replace(/\./gu, "_")),
    metadata: carrierMetadata,
  });
}

export function summarizeCapabilityPackage(
  capabilityPackage: CapabilityPackage,
): CapabilityPackageSummary {
  const metadata = capabilityPackage.metadata;
  return {
    templateVersion: capabilityPackage.templateVersion,
    capabilityKey: capabilityPackage.manifest.capabilityKey,
    capabilityKind: capabilityPackage.manifest.capabilityKind,
    runtimeKind: capabilityPackage.adapter.runtimeKind,
    builderId: capabilityPackage.builder.builderId,
    replayPolicy: capabilityPackage.replayPolicy,
    activationSpecRef: capabilityPackage.builder.activationSpecRef,
    lifecycle: capabilityPackage.lifecycle,
    routeHints: capabilityPackage.manifest.routeHints,
    usageDocRef: capabilityPackage.usage.usageDocRef,
    skillRef: capabilityPackage.usage.skillRef,
    compatibilityAliases: Array.isArray(metadata?.compatibilityAliases)
      ? metadata.compatibilityAliases as string[]
      : undefined,
    entryFamily: typeof metadata?.finalEntryFamily === "string"
      ? metadata.finalEntryFamily
      : typeof metadata?.publicEntryFamily === "string"
        ? metadata.publicEntryFamily
        : undefined,
    backingCapability: typeof metadata?.backingCapability === "string"
      ? metadata.backingCapability
      : undefined,
    carrierEntryFamilies: Array.isArray(metadata?.carrierEntryFamilies)
      ? metadata.carrierEntryFamilies as string[]
      : undefined,
    governance:
      typeof metadata?.governance === "object" &&
      metadata?.governance !== null
        ? metadata.governance as Record<string, unknown>
        : undefined,
    carrier:
      typeof metadata?.carrier === "object" &&
      metadata?.carrier !== null
        ? metadata.carrier as Record<string, unknown>
        : undefined,
  };
}
