import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  createCapabilityPackageFixture,
  createCapabilityPackageFromProvisionBundle,
  createRaxComputerCapabilityPackage,
  createRaxMcpCapabilityPackage,
  createRaxSkillCapabilityPackage,
} from "./index.js";
import { createPoolActivationSpec, createProvisionArtifactBundle } from "../ta-pool-types/index.js";

test("capability package fixture satisfies the frozen seven-part template", () => {
  const capabilityPackage = createCapabilityPackageFixture({
    capabilityKey: "mcp.playwright",
    replayPolicy: "auto_after_verify",
  });

  assert.equal(capabilityPackage.templateVersion, "tap-capability-package.v1");
  assert.equal(capabilityPackage.manifest.capabilityKey, "mcp.playwright");
  assert.equal(capabilityPackage.builder.replayCapability, "auto_after_verify");
  assert.equal(capabilityPackage.replayPolicy, "auto_after_verify");
  assert.equal(capabilityPackage.activationSpec?.targetPool, "ta-capability-pool");
  assert.equal(capabilityPackage.usage.exampleInvocations.length, 1);
});

test("capability package can be created directly from a ready provision bundle", () => {
  const activationSpec = createPoolActivationSpec({
    targetPool: "ta-capability-pool",
    activationMode: "activate_after_verify",
    registerOrReplace: "register_or_replace",
    generationStrategy: "create_next_generation",
    drainStrategy: "graceful",
    manifestPayload: {
      capabilityKey: "mcp.playwright",
      version: "1.0.0",
    },
    bindingPayload: {
      adapterId: "adapter.playwright",
      runtimeKind: "mcp",
    },
    adapterFactoryRef: "factory:playwright",
  });
  const bundle = createProvisionArtifactBundle({
    bundleId: "bundle.playwright",
    provisionId: "provision.playwright",
    status: "ready",
    toolArtifact: { artifactId: "tool.playwright", kind: "tool", ref: "tool:playwright" },
    bindingArtifact: {
      artifactId: "binding.playwright",
      kind: "binding",
      ref: "binding:playwright",
    },
    verificationArtifact: {
      artifactId: "verification.playwright",
      kind: "verification",
      ref: "verification:playwright",
    },
    usageArtifact: { artifactId: "usage.playwright", kind: "usage", ref: "usage:playwright" },
    activationSpec,
    replayPolicy: "manual",
  });

  const capabilityPackage = createCapabilityPackageFromProvisionBundle({
    bundle,
    manifest: {
      capabilityKey: "mcp.playwright",
      capabilityKind: "tool",
      description: "Provisioned browser capability.",
      supportedPlatforms: ["linux"],
    },
    adapter: {
      adapterId: "adapter.playwright",
      runtimeKind: "mcp",
      supports: ["open_browser"],
      prepare: { ref: "adapter.prepare:playwright" },
      execute: { ref: "adapter.execute:playwright" },
    },
    policy: {
      defaultBaseline: {
        grantedTier: "B2",
        mode: "balanced",
      },
      recommendedMode: "standard",
      riskLevel: "risky",
      reviewRequirements: ["allow_with_constraints"],
    },
    builder: {
      builderId: "builder.playwright",
      buildStrategy: "install-and-register",
      activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: "manual",
    },
    verification: {
      smokeEntry: "smoke:mcp:playwright",
      healthEntry: "health:mcp:playwright",
    },
    usage: {
      usageDocRef: "docs/ability/25-tap-capability-package-template.md",
      exampleInvocations: [
        {
          exampleId: "example.playwright.open",
          capabilityKey: "mcp.playwright",
          operation: "open_browser",
        },
      ],
    },
    lifecycle: {
      installStrategy: "install into user space",
      replaceStrategy: "register_or_replace",
      rollbackStrategy: "restore previous binding",
      deprecateStrategy: "freeze new registrations before removal",
      cleanupStrategy: "cleanup old artifacts after drain",
    },
  });

  assert.equal(capabilityPackage.replayPolicy, "manual");
  assert.equal(capabilityPackage.artifacts?.bindingArtifact.ref, "binding:playwright");
  assert.equal(
    capabilityPackage.builder.activationSpecRef,
    "activation-spec:ta-capability-pool:activate_after_verify:factory:playwright",
  );
});

test("capability package validation rejects replay policy drift between builder and package", () => {
  assert.throws(
    () =>
      createCapabilityPackage({
        manifest: {
          capabilityKey: "mcp.playwright",
          capabilityKind: "tool",
          description: "Provisioned browser capability.",
          supportedPlatforms: ["linux"],
        },
        adapter: {
          adapterId: "adapter.playwright",
          runtimeKind: "mcp",
          supports: ["open_browser"],
          prepare: { ref: "adapter.prepare:playwright" },
          execute: { ref: "adapter.execute:playwright" },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B2",
            mode: "balanced",
          },
          recommendedMode: "standard",
          riskLevel: "risky",
          reviewRequirements: ["allow_with_constraints"],
        },
        builder: {
          builderId: "builder.playwright",
          buildStrategy: "install-and-register",
          activationSpecRef: "activation-spec:playwright",
          replayCapability: "manual",
        },
        verification: {
          smokeEntry: "smoke:mcp:playwright",
          healthEntry: "health:mcp:playwright",
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          exampleInvocations: [
            {
              exampleId: "example.playwright.open",
              capabilityKey: "mcp.playwright",
              operation: "open_browser",
            },
          ],
        },
        lifecycle: {
          installStrategy: "install into user space",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore previous binding",
          deprecateStrategy: "freeze new registrations before removal",
          cleanupStrategy: "cleanup old artifacts after drain",
        },
        replayPolicy: "auto_after_verify",
      }),
    /replayPolicy must match builder\.replayCapability/,
  );
});

test("rax mcp capability package locks shared entry keys and keeps legacy aliases as compatibility metadata", () => {
  const capabilityPackage = createRaxMcpCapabilityPackage({
    capabilityKey: "mcp.shared.call",
    originalCapabilityKey: "mcp.call",
    route: {
      provider: "openai",
      model: "gpt-5.4",
      layer: "agent",
    },
    input: {
      connectionId: "conn-1",
      toolName: "browser.search",
    },
  });

  assert.equal(capabilityPackage.manifest.capabilityKey, "mcp.shared.call");
  assert.equal(capabilityPackage.adapter.runtimeKind, "rax-mcp");
  assert.deepEqual(capabilityPackage.metadata?.compatibilityAliases, ["mcp.call"]);
  assert.equal(
    capabilityPackage.lifecycle.deprecateStrategy,
    "Keep legacy top-level mcp.* aliases compatibility-only and stop assigning them as the primary dispatch surface.",
  );
});

test("rax computer capability package keeps computer.* public while pointing at existing MCP carrier entries", () => {
  const capabilityPackage = createRaxComputerCapabilityPackage({
    capabilityKey: "computer.use",
    route: {
      provider: "openai",
      model: "gpt-5.4",
      layer: "agent",
    },
    input: {
      connectionId: "conn-computer",
      toolName: "browser_navigate",
      arguments: {
        url: "https://example.com",
      },
    },
  });

  assert.equal(capabilityPackage.manifest.capabilityKey, "computer.use");
  assert.equal(capabilityPackage.manifest.capabilityKind, "runtime");
  assert.deepEqual(capabilityPackage.manifest.dependencies, ["mcp.shared.call"]);
  assert.equal(capabilityPackage.adapter.runtimeKind, "rax-mcp");
  assert.equal(capabilityPackage.metadata?.publicEntryFamily, "computer");
  assert.equal(capabilityPackage.metadata?.backingCapability, "mcp.shared.call");
  assert.deepEqual(capabilityPackage.metadata?.carrierEntryFamilies, ["mcp.shared", "mcp.native"]);
  assert.equal(
    ((capabilityPackage.metadata?.governance as { bridge?: string } | undefined)?.bridge),
    "ta.execution.bridge",
  );
});

test("rax skill capability package maps skill runtime activation to carrier-aware lifecycle metadata", () => {
  const capabilityPackage = createRaxSkillCapabilityPackage({
    capabilityKey: "skill.use",
    route: {
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "agent",
    },
    container: {
      descriptor: {
        id: "browser-skill",
        name: "Browser Skill",
        description: "Drive a browser workflow.",
        version: "1.0.0",
        tags: ["browser"],
        triggers: ["browser"],
        source: {
          kind: "local",
          rootDir: "/skills/browser",
          entryPath: "/skills/browser/SKILL.md",
        },
      },
      source: {
        kind: "local",
        rootDir: "/skills/browser",
        entryPath: "/skills/browser/SKILL.md",
      },
      entry: {
        path: "/skills/browser/SKILL.md",
        content: "# Browser Skill",
      },
      resources: [],
      helpers: [],
      bindings: {},
      policy: {
        invocationMode: "auto",
        requiresApproval: false,
        riskLevel: "medium",
        sourceTrust: "local",
      },
      loading: {
        metadata: "always",
        entry: "on-activate",
        resources: "on-demand",
        helpers: "on-demand",
      },
      ledger: {
        discoverCount: 1,
        activationCount: 2,
      },
    },
    activation: {
      provider: "anthropic",
      mode: "anthropic-sdk-filesystem",
      layer: "agent",
      officialCarrier: "anthropic-sdk-filesystem-skill",
      payload: {},
      entry: {
        path: "/skills/browser/SKILL.md",
        content: "# Browser Skill",
      },
      resources: [],
      helpers: [],
    },
    invocation: {
      key: "skill.activate",
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "agent",
      adapterId: "skill.anthropic.anthropic-sdk-filesystem",
      sdk: {
        packageName: "@anthropic-ai/sdk",
        entrypoint: "client.messages.create",
      },
      payload: {},
    },
  });

  assert.equal(capabilityPackage.manifest.capabilityKey, "skill.use");
  assert.equal(capabilityPackage.usage.skillRef, "browser-skill");
  const carrier = capabilityPackage.metadata?.carrier as { officialCarrier?: string } | undefined;
  assert.equal(carrier?.officialCarrier, "anthropic-sdk-filesystem-skill");
  assert.match(
    capabilityPackage.lifecycle.installStrategy,
    /anthropic-sdk-filesystem-skill/u,
  );
});
