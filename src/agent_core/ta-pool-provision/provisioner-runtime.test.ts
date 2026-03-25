import assert from "node:assert/strict";
import test from "node:test";

import { createProvisionRequest } from "../ta-pool-types/index.js";
import { ProvisionRegistry } from "./provision-registry.js";
import { createProvisionerRuntime } from "./provisioner-runtime.js";

test("provisioner runtime records building then ready through the default provisioner worker bridge", async () => {
  const registry = new ProvisionRegistry();
  let counter = 0;
  const runtime = createProvisionerRuntime({
    registry,
    clock: () => new Date("2026-03-18T08:00:00.000Z"),
    idFactory: () => `bundle-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-1",
    sourceRequestId: "request-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Need playwright MCP.",
    createdAt: "2026-03-18T08:00:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const history = runtime.getBundleHistory(request.provisionId);

  assert.equal(history.length, 2);
  assert.equal(history[0]?.status, "building");
  assert.equal(history[1]?.status, "ready");
  assert.equal(bundle.status, "ready");
  assert.equal(bundle.toolArtifact?.ref, "provisioned/mcp.playwright/tool.json");
  assert.equal(bundle.activationSpec?.activationMode, "stage_only");
  assert.equal(bundle.replayPolicy, "re_review_then_dispatch");
  assert.equal(bundle.metadata?.workerLane, "bootstrap");
  assert.equal(bundle.metadata?.workerPromptPackId, "provisioner-worker:bootstrap:v1");
  assert.equal((bundle.metadata?.tmaPlanner as { lane?: string } | undefined)?.lane, "bootstrap");
  assert.equal((bundle.metadata?.tmaExecutor as { report?: { status?: string } } | undefined)?.report?.status, "completed");
  assert.equal(registry.get(request.provisionId)?.bundle?.status, "ready");
  assert.deepEqual(runtime.assetIndex.listCapabilityKeysByStatus(["ready_for_review"]), ["mcp.playwright"]);
  assert.equal(
    runtime.assetIndex.getCurrent(request.provisionId)?.activation.bindingArtifactRef,
    "provisioned/mcp.playwright/binding.json",
  );
});

test("provisioner runtime records building then failed when builder throws", async () => {
  const registry = new ProvisionRegistry();
  let counter = 0;
  const runtime = createProvisionerRuntime({
    registry,
    builder: async () => {
      throw new Error("mock builder crashed");
    },
    clock: () => new Date("2026-03-18T08:30:00.000Z"),
    idFactory: () => `bundle-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-2",
    sourceRequestId: "request-2",
    requestedCapabilityKey: "computer.use",
    reason: "Need computer use runtime.",
    createdAt: "2026-03-18T08:30:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const history = runtime.getBundleHistory(request.provisionId);

  assert.equal(history.length, 2);
  assert.equal(history[0]?.status, "building");
  assert.equal(history[1]?.status, "failed");
  assert.equal(bundle.status, "failed");
  assert.equal(bundle.error?.code, "ta_pool_provision_build_failed");
  assert.equal(registry.get(request.provisionId)?.bundle?.status, "failed");
});

test("provisioner runtime rejects worker outputs that try to complete the original task", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    workerBridge: async (input) => {
      const output = {
        workerAction: "build_capability_package" as const,
        originalTaskDisposition: "left_for_main_agent" as const,
        buildSummary: "default summary",
        toolArtifact: {
          artifactId: "tool-1",
          kind: "tool",
          ref: "tool:playwright",
        },
        bindingArtifact: {
          artifactId: "binding-1",
          kind: "binding",
          ref: "binding:playwright",
        },
        verificationArtifact: {
          artifactId: "verification-1",
          kind: "verification",
          ref: "verify:playwright",
        },
        usageArtifact: {
          artifactId: "usage-1",
          kind: "usage",
          ref: "usage:playwright",
        },
        activationPayload: {
          targetPool: "ta-capability-pool",
          activationMode: "stage_only" as const,
          registerOrReplace: "register_or_replace" as const,
          generationStrategy: "create_next_generation" as const,
          drainStrategy: "graceful" as const,
          manifestPayload: {
            capabilityKey: input.request.requestedCapabilityKey,
          },
          bindingPayload: {
            adapterId: "adapter.playwright",
          },
          adapterFactoryRef: "factory:playwright",
        },
        replayRecommendation: {
          policy: "manual" as const,
          reason: "manual replay",
          requiresReviewerApproval: true,
          suggestedTrigger: "manual_only" as const,
        },
        metadata: {},
      };

      return {
        ...output,
        originalTaskDisposition: "completed_original_task" as "left_for_main_agent",
      };
    },
    clock: () => new Date("2026-03-18T08:45:00.000Z"),
    idFactory: () => `bundle-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-3",
    sourceRequestId: "request-3",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Need a staged browser capability package.",
    createdAt: "2026-03-18T08:45:00.000Z",
  });

  const bundle = await runtime.submit(request);

  assert.equal(bundle.status, "failed");
  assert.match(bundle.error?.message ?? "", /leave the original task to the main agent/i);
});

test("provisioner runtime emits a formal tooling package for bootstrap B-group capabilities", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    clock: () => new Date("2026-03-24T08:00:00.000Z"),
    idFactory: () => `bundle-tooling-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-tooling-1",
    sourceRequestId: "request-tooling-1",
    requestedCapabilityKey: "repo.write",
    reason: "Need bootstrap repo write tooling package.",
    createdAt: "2026-03-24T08:00:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const toolMetadata = bundle.toolArtifact?.metadata as {
    manifest?: { capabilityKey?: string };
    formalCapabilityPackage?: boolean;
  } | undefined;

  assert.equal(bundle.status, "ready");
  assert.equal(bundle.metadata?.packageTemplateStatus, "formal");
  assert.equal(bundle.metadata?.activationDriverImplemented, true);
  assert.equal(toolMetadata?.manifest?.capabilityKey, "repo.write");
  assert.equal(toolMetadata?.formalCapabilityPackage, true);
  assert.equal(bundle.activationSpec?.adapterFactoryRef, "factory:tap-tooling:repo.write");
});
