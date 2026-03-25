import type { TaCapabilityTier } from "../ta-pool-types/index.js";
import {
  createPoolActivationSpec,
  type PoolActivationSpec,
  type ReplayPolicy,
} from "../ta-pool-types/index.js";
import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  type CapabilityPackage,
} from "./capability-package.js";

export const SEARCH_GROUND_CAPABILITY_KEY = "search.ground";
export const RAX_WEBSEARCH_ACTIVATION_FACTORY_REF =
  "factory:search.ground.rax-websearch";

export interface CreateRaxWebsearchCapabilityPackageOptions {
  capabilityKey?: string;
  adapterId?: string;
  runtimeKind?: string;
  tier?: TaCapabilityTier;
  version?: string;
  generation?: number;
  replayPolicy?: ReplayPolicy;
  activationSpec?: PoolActivationSpec;
}

export function createRaxWebsearchCapabilityPackage(
  options: CreateRaxWebsearchCapabilityPackageOptions = {},
): CapabilityPackage {
  const capabilityKey = options.capabilityKey ?? SEARCH_GROUND_CAPABILITY_KEY;
  const adapterId = options.adapterId ?? `adapter:${capabilityKey}`;
  const runtimeKind = options.runtimeKind ?? "rax-websearch";
  const replayPolicy = options.replayPolicy ?? "re_review_then_dispatch";

  const activationSpec =
    options.activationSpec ??
    createPoolActivationSpec({
      targetPool: "ta-capability-pool",
      activationMode: "activate_after_verify",
      registerOrReplace: "register_or_replace",
      generationStrategy: "create_next_generation",
      drainStrategy: "graceful",
      manifestPayload: {
        capabilityKey,
        capabilityId: `capability:${capabilityKey}:${options.generation ?? 1}`,
        version: options.version ?? "1.0.0",
        generation: options.generation ?? 1,
        kind: "tool",
        description: "Grounded web search bridged through the RAX websearch runtime.",
        supportsPrepare: true,
        supportsCancellation: false,
        routeHints: [
          { key: "runtime", value: runtimeKind },
          { key: "capability", value: capabilityKey },
        ],
        tags: ["search", "grounding", "tap", "rax"],
      },
      bindingPayload: {
        adapterId,
        runtimeKind,
      },
      adapterFactoryRef: RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
      metadata: {
        packageKind: "first-class-capability",
      },
    });

  return createCapabilityPackage({
    manifest: {
      capabilityKey,
      capabilityKind: "tool",
      tier: options.tier ?? "B1",
      version: options.version ?? "1.0.0",
      generation: options.generation ?? 1,
      description: "Grounded web search routed through the RAX facade and TAP execution lane.",
      dependencies: ["rax.websearch"],
      tags: ["search", "grounding", "tap", "rax"],
      routeHints: [
        { key: "runtime", value: runtimeKind },
        { key: "adapter_factory", value: RAX_WEBSEARCH_ACTIVATION_FACTORY_REF },
      ],
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: {
        firstClass: true,
      },
    },
    adapter: {
      adapterId,
      runtimeKind,
      supports: [capabilityKey],
      prepare: {
        ref: "integrations/rax-websearch-adapter#prepare",
        description: "Normalize search.ground input into a prepared RAX websearch invocation.",
      },
      execute: {
        ref: "integrations/rax-websearch-adapter#execute",
        description: "Execute the prepared search.ground invocation through the RAX facade.",
      },
      resultMapping: {
        successStatuses: ["success", "partial"],
        artifactKinds: ["evidence", "citations", "sources"],
      },
      metadata: {
        activationFactoryRef: RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: options.tier ?? "B1",
        mode: "standard",
        scope: {
          allowedOperations: ["network.read", "evidence.capture"],
          providerHints: ["openai", "anthropic", "deepmind"],
        },
      },
      recommendedMode: "standard",
      riskLevel: "normal",
      defaultScope: {
        allowedOperations: ["network.read", "evidence.capture"],
        providerHints: ["openai", "anthropic", "deepmind"],
      },
      reviewRequirements: ["allow_with_constraints"],
      safetyFlags: ["network_access", "external_content"],
      humanGateRequirements: [],
    },
    builder: {
      builderId: "builder:search.ground.rax-websearch",
      buildStrategy: "mount-existing-runtime",
      requiresNetwork: true,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: ["workspace/**"],
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: replayPolicy,
    },
    verification: {
      smokeEntry: "test:agent_core:rax-websearch-adapter",
      healthEntry: "health:rax:websearch",
      successCriteria: [
        "search query returns an answer or partial result",
        "citations and sources remain attached to the envelope",
      ],
      failureSignals: [
        "provider/model/query input is missing",
        "search result returns blocked, failed, or timeout",
      ],
      evidenceOutput: ["capability-result-envelope", "websearch-evidence"],
    },
    usage: {
      usageDocRef: "docs/ability/agent-capability-interface-task-pack/08-rax-websearch-adapter.md",
      bestPractices: [
        "Always provide provider, model, and query.",
        "Prefer explicit citations and freshness hints when the answer needs grounding.",
      ],
      knownLimits: [
        "Depends on a configured upstream websearch provider.",
        "External content quality and availability can change between runs.",
      ],
      exampleInvocations: [
        {
          exampleId: "example.search-ground.query",
          capabilityKey,
          operation: capabilityKey,
          input: {
            provider: "openai",
            model: "gpt-5.4",
            query: "What is Praxis?",
            citations: "required",
          },
          notes: "Minimal grounded search routed through the RAX runtime.",
        },
      ],
    },
    lifecycle: {
      installStrategy: "reuse configured RAX websearch runtime without additional install",
      replaceStrategy: "register_or_replace active binding generation",
      rollbackStrategy: "restore the previous grounded-search binding",
      deprecateStrategy: "disable the adapter factory before draining superseded bindings",
      cleanupStrategy: "clear superseded binding artifacts after drain completes",
      generationPolicy: "create_next_generation",
    },
    activationSpec,
    replayPolicy,
    artifacts: {
      toolArtifact: {
        artifactId: `tool:${capabilityKey}`,
        kind: "tool",
        ref: `tool:${capabilityKey}`,
      },
      bindingArtifact: {
        artifactId: `binding:${capabilityKey}`,
        kind: "binding",
        ref: `binding:${capabilityKey}`,
      },
      verificationArtifact: {
        artifactId: `verification:${capabilityKey}`,
        kind: "verification",
        ref: `verification:${capabilityKey}`,
      },
      usageArtifact: {
        artifactId: `usage:${capabilityKey}`,
        kind: "usage",
        ref: `usage:${capabilityKey}`,
      },
    },
    metadata: {
      bundleId: `bundle:${capabilityKey}:rax-websearch`,
      provisionId: `provision:${capabilityKey}:rax-websearch`,
      packageKind: "first-class-capability",
    },
  });
}
