import type { TaCapabilityTier, ReplayPolicy, PoolActivationSpec } from "../ta-pool-types/index.js";

import type { CapabilityPackage } from "./capability-package.js";
import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
} from "./capability-package.js";

export const MCP_READ_FAMILY_CAPABILITY_KEYS = [
  "mcp.listTools",
  "mcp.listResources",
  "mcp.readResource",
] as const;

export type McpReadFamilyCapabilityKey =
  (typeof MCP_READ_FAMILY_CAPABILITY_KEYS)[number];

export interface CreateMcpReadCapabilityPackageInput {
  capabilityKey: McpReadFamilyCapabilityKey;
  tier?: TaCapabilityTier;
  runtimeKind?: string;
  replayPolicy?: ReplayPolicy;
  activationSpec?: PoolActivationSpec;
}

interface McpReadFamilyCapabilityDefaults {
  description: string;
  tags: string[];
  verification: {
    smokeEntry: string;
    healthEntry: string;
    successCriteria: string[];
    failureSignals: string[];
    evidenceOutput: string[];
  };
  usage: {
    bestPractices: string[];
    knownLimits: string[];
    exampleOperation: string;
    exampleInput: Record<string, unknown>;
    exampleNotes: string;
  };
}

const MCP_READ_FAMILY_DEFAULTS: Record<
  McpReadFamilyCapabilityKey,
  McpReadFamilyCapabilityDefaults
> = {
  "mcp.listTools": {
    description: "Read-only MCP capability for enumerating tool metadata on an active connection.",
    tags: ["mcp", "read-family", "tool-discovery"],
    verification: {
      smokeEntry: "smoke:mcp:list-tools",
      healthEntry: "health:mcp:list-tools",
      successCriteria: [
        "tool inventory returned",
        "result metadata records toolCount",
      ],
      failureSignals: [
        "connection not found",
        "tool enumeration failed",
      ],
      evidenceOutput: ["tool-list", "metadata.toolCount"],
    },
    usage: {
      bestPractices: [
        "Call this before mcp.call when the available tool surface is unknown.",
        "Treat the returned tool descriptors as read-only inventory.",
      ],
      knownLimits: [
        "Requires an existing MCP connection.",
        "Does not execute any tool side effects.",
      ],
      exampleOperation: "list_tools",
      exampleInput: {
        route: {
          provider: "openai",
          model: "gpt-5.4",
        },
        input: {
          connectionId: "conn-demo",
        },
      },
      exampleNotes: "Enumerate the available MCP tools before choosing a tool invocation.",
    },
  },
  "mcp.listResources": {
    description: "Read-only MCP capability for enumerating resource metadata on an active connection.",
    tags: ["mcp", "read-family", "resource-discovery"],
    verification: {
      smokeEntry: "smoke:mcp:list-resources",
      healthEntry: "health:mcp:list-resources",
      successCriteria: [
        "resource inventory returned",
        "result metadata records resourceCount",
      ],
      failureSignals: [
        "connection not found",
        "resource enumeration failed",
      ],
      evidenceOutput: ["resource-list", "metadata.resourceCount"],
    },
    usage: {
      bestPractices: [
        "Call this before mcp.readResource when the available resource surface is unknown.",
        "Treat the returned resource descriptors as read-only inventory.",
      ],
      knownLimits: [
        "Requires an existing MCP connection.",
        "Does not read the resource body itself.",
      ],
      exampleOperation: "list_resources",
      exampleInput: {
        route: {
          provider: "openai",
          model: "gpt-5.4",
        },
        input: {
          connectionId: "conn-demo",
        },
      },
      exampleNotes: "Enumerate the available MCP resources before choosing a URI to read.",
    },
  },
  "mcp.readResource": {
    description: "Read-only MCP capability for fetching resource contents from an active connection.",
    tags: ["mcp", "read-family", "resource-read"],
    verification: {
      smokeEntry: "smoke:mcp:read-resource",
      healthEntry: "health:mcp:read-resource",
      successCriteria: [
        "resource payload returned",
        "result metadata records uri",
      ],
      failureSignals: [
        "connection not found",
        "resource read failed",
      ],
      evidenceOutput: ["resource-contents", "metadata.uri"],
    },
    usage: {
      bestPractices: [
        "Use a known URI or a prior discovery step before reading.",
        "Expect returned contents to be provider- or server-specific payloads.",
      ],
      knownLimits: [
        "Requires an existing MCP connection.",
        "Returned contents may contain binary or structured blobs.",
      ],
      exampleOperation: "read_resource",
      exampleInput: {
        route: {
          provider: "openai",
          model: "gpt-5.4",
        },
        input: {
          connectionId: "conn-demo",
          uri: "memory://README",
        },
      },
      exampleNotes: "Fetch a specific MCP resource URI without invoking any tool side effects.",
    },
  },
};

export function isMcpReadFamilyCapabilityKey(
  capabilityKey: string,
): capabilityKey is McpReadFamilyCapabilityKey {
  return MCP_READ_FAMILY_CAPABILITY_KEYS.includes(
    capabilityKey as McpReadFamilyCapabilityKey,
  );
}

export function createMcpReadCapabilityPackage(
  input: CreateMcpReadCapabilityPackageInput,
): CapabilityPackage {
  if (!isMcpReadFamilyCapabilityKey(input.capabilityKey)) {
    throw new Error(
      `Unsupported MCP read family capability: ${input.capabilityKey}.`,
    );
  }

  const defaults = MCP_READ_FAMILY_DEFAULTS[input.capabilityKey];
  const runtimeKind = input.runtimeKind ?? "rax-mcp";
  const replayPolicy = input.replayPolicy ?? "auto_after_verify";
  const activationSpec = input.activationSpec ?? {
    targetPool: "ta-capability-pool",
    activationMode: "activate_after_verify",
    registerOrReplace: "register_or_replace",
    generationStrategy: "create_next_generation",
    drainStrategy: "graceful",
    manifestPayload: {
      capabilityKey: input.capabilityKey,
      version: "1.0.0",
    },
    bindingPayload: {
      adapterId: "rax.mcp.adapter",
      runtimeKind,
    },
    adapterFactoryRef: "factory:rax.mcp.adapter",
  };

  return createCapabilityPackage({
    manifest: {
      capabilityKey: input.capabilityKey,
      capabilityKind: "resource",
      tier: input.tier ?? "B1",
      version: "1.0.0",
      generation: 1,
      description: defaults.description,
      dependencies: ["rax.mcp.shared"],
      tags: defaults.tags,
      routeHints: [
        { key: "capability_family", value: "mcp-read" },
        { key: "mcp_action", value: input.capabilityKey.replace("mcp.", "") },
      ],
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: {
        riskProfile: "read-only",
      },
    },
    adapter: {
      adapterId: "rax.mcp.adapter",
      runtimeKind,
      supports: [input.capabilityKey],
      prepare: { ref: "adapter.prepare:rax.mcp.adapter" },
      execute: { ref: "adapter.execute:rax.mcp.adapter" },
      resultMapping: {
        successStatuses: ["success"],
        artifactKinds: ["verification", "usage"],
        metadata: {
          operationFamily: "read",
        },
      },
      metadata: {
        action: input.capabilityKey,
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: input.tier ?? "B1",
        mode: "balanced",
        scope: {
          allowedOperations: ["read"],
          providerHints: ["mcp"],
          metadata: {
            actionFamily: "read",
          },
        },
      },
      recommendedMode: "standard",
      riskLevel: "normal",
      defaultScope: {
        allowedOperations: ["read"],
        providerHints: ["mcp"],
      },
      reviewRequirements: ["allow"],
      safetyFlags: ["mcp_shared_runtime"],
      humanGateRequirements: [],
      metadata: {
        readOnly: true,
      },
    },
    builder: {
      builderId: `builder.${input.capabilityKey}`,
      buildStrategy: "register-shared-runtime-read-adapter",
      requiresNetwork: false,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: ["workspace/**"],
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: replayPolicy,
      metadata: {
        activationFamily: "mcp-read",
      },
    },
    verification: {
      smokeEntry: defaults.verification.smokeEntry,
      healthEntry: defaults.verification.healthEntry,
      successCriteria: defaults.verification.successCriteria,
      failureSignals: defaults.verification.failureSignals,
      evidenceOutput: defaults.verification.evidenceOutput,
    },
    usage: {
      usageDocRef: "docs/ability/25-tap-capability-package-template.md",
      bestPractices: defaults.usage.bestPractices,
      knownLimits: defaults.usage.knownLimits,
      exampleInvocations: [
        {
          exampleId: `example.${input.capabilityKey}`,
          capabilityKey: input.capabilityKey,
          operation: defaults.usage.exampleOperation,
          input: defaults.usage.exampleInput,
          notes: defaults.usage.exampleNotes,
        },
      ],
      metadata: {
        readOnly: true,
      },
    },
    lifecycle: {
      installStrategy: "register shared-runtime MCP read capability into the pool",
      replaceStrategy: "register_or_replace next generation after verification",
      rollbackStrategy: "restore previous binding generation",
      deprecateStrategy: "drain old read capability generation before removal",
      cleanupStrategy: "remove superseded MCP read capability metadata after drain",
      generationPolicy: "create_next_generation",
    },
    activationSpec,
    replayPolicy,
    metadata: {
      capabilityFamily: "mcp-read",
      action: input.capabilityKey,
    },
  });
}
