import assert from "node:assert/strict";
import test from "node:test";

import {
  MCP_READ_FAMILY_CAPABILITY_KEYS,
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  createCapabilityPackageFixture,
  createCapabilityPackageFromProvisionBundle,
  createMcpReadCapabilityPackage,
  isMcpReadFamilyCapabilityKey,
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

test("MCP read family capability packages freeze lower-risk defaults for listTools and readResource", () => {
  for (const capabilityKey of MCP_READ_FAMILY_CAPABILITY_KEYS) {
    const capabilityPackage = createMcpReadCapabilityPackage({
      capabilityKey,
    });

    assert.equal(isMcpReadFamilyCapabilityKey(capabilityKey), true);
    assert.equal(capabilityPackage.manifest.capabilityKey, capabilityKey);
    assert.equal(capabilityPackage.manifest.capabilityKind, "resource");
    assert.equal(capabilityPackage.policy.riskLevel, "normal");
    assert.deepEqual(capabilityPackage.policy.defaultBaseline.scope?.allowedOperations, ["read"]);
    assert.deepEqual(capabilityPackage.adapter.supports, [capabilityKey]);
    assert.equal(capabilityPackage.adapter.adapterId, "rax.mcp.adapter");
    assert.equal(capabilityPackage.builder.replayCapability, "auto_after_verify");
    assert.equal(capabilityPackage.metadata?.capabilityFamily, "mcp-read");
    assert.equal(
      capabilityPackage.usage.exampleInvocations[0]?.capabilityKey,
      capabilityKey,
    );
  }
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
