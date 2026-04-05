import assert from "node:assert/strict";
import test from "node:test";

import { createProvisionRequest } from "../ta-pool-types/index.js";
import { ProvisionRegistry } from "./provision-registry.js";
import { createProvisionerDurableSnapshot } from "./provision-durable-snapshot.js";
import { createProvisionerRuntime } from "./provisioner-runtime.js";
import { createModelBackedProvisionerWorkerBridge } from "./provisioner-model-worker.js";

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
  assert.equal((bundle.metadata?.tmaDeliveryReceipt as { completionTarget?: string } | undefined)?.completionTarget, "ready_bundle");
  assert.equal((bundle.metadata?.tmaDeliveryReceipt as { plannerSessionId?: string } | undefined)?.plannerSessionId, "tma:provision-1:planner");
  assert.equal((bundle.metadata?.tmaDeliveryReceipt as { executorSessionId?: string } | undefined)?.executorSessionId, "tma:provision-1:executor");
  assert.deepEqual(
    (bundle.metadata?.tmaDeliveryReceipt as {
      verificationSummary?: { total?: number; passed?: number; failed?: number; skipped?: number };
    } | undefined)?.verificationSummary,
    {
      total: 2,
      passed: 2,
      failed: 0,
      skipped: 0,
    },
  );
  assert.equal(
    (bundle.metadata?.tmaDeliveryReceipt as {
      executionSummary?: { status?: string; summary?: string };
    } | undefined)?.executionSummary?.status,
    "completed",
  );
  assert.equal(registry.get(request.provisionId)?.bundle?.status, "ready");
  assert.deepEqual(runtime.assetIndex.listCapabilityKeysByStatus(["ready_for_review"]), ["mcp.playwright"]);
  assert.equal(
    runtime.assetIndex.getCurrent(request.provisionId)?.activation.bindingArtifactRef,
    "provisioned/mcp.playwright/binding.json",
  );
  const deliveryReport = runtime.createDeliveryReport(request.provisionId);
  assert.deepEqual(deliveryReport.verificationSummary, {
    total: 2,
    passed: 2,
    failed: 0,
    skipped: 0,
  });
  assert.equal(deliveryReport.verificationItems?.[0]?.status, "passed");
  assert.equal(deliveryReport.executionSummary?.status, "completed");
  assert.equal(deliveryReport.rollbackHandleId, "plan:provision-1:rollback");
  assert.deepEqual(runtime.listResumableTmaSessions(), []);
  const plannerSession = runtime.getTmaSession("tma:provision-1:planner");
  assert.equal(plannerSession?.status, "completed");
  assert.equal(plannerSession?.metadata?.phaseResult, "ready_for_executor_delivery");
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

test("provisioner runtime can use the model-backed worker bridge for build summary refinement", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    workerBridge: createModelBackedProvisionerWorkerBridge({
      executor: async ({ intent }) => ({
        provider: "openai",
        model: "gpt-5.4",
        layer: "api",
        raw: { text: "ok" },
        result: {
          resultId: `${intent.intentId}:result`,
          sessionId: intent.sessionId,
          runId: intent.runId,
          source: "model",
          status: "success",
          output: {
            text: JSON.stringify({
              buildSummary: "model-backed TMA summary",
              replayRecommendationReason: "model-backed replay rationale",
              metadata: {
                rationale: "Keep activation outside the worker bridge.",
              },
            }),
          },
          emittedAt: "2026-03-30T10:20:00.000Z",
        },
      }),
    }),
    clock: () => new Date("2026-03-30T10:20:00.000Z"),
    idFactory: () => `bundle-model-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-model-1",
    sourceRequestId: "request-model-1",
    requestedCapabilityKey: "repo.write",
    reason: "Need model-backed bundle narrative.",
    createdAt: "2026-03-30T10:20:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const provisionerModelMetadata = bundle.metadata?.provisionerModelMetadata as
    | { rationale?: string }
    | undefined;
  const replayRecommendation = bundle.metadata?.replayRecommendation as
    | { reason?: string }
    | undefined;

  assert.equal(bundle.status, "ready");
  assert.equal(bundle.metadata?.modelBacked, true);
  assert.equal(bundle.metadata?.buildSummary, "model-backed TMA summary");
  assert.equal(provisionerModelMetadata?.rationale, "Keep activation outside the worker bridge.");
  assert.equal(bundle.replayPolicy, "re_review_then_dispatch");
  assert.equal(
    replayRecommendation?.reason,
    "model-backed replay rationale",
  );
  assert.equal(bundle.metadata?.workerBridge, true);
});

test("provisioner delivery report highlights failed verification evidence from the ready receipt", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    workerBridge: async (input) => {
      const defaultOutput = {
        workerAction: "build_capability_package" as const,
        originalTaskDisposition: "left_for_main_agent" as const,
        buildSummary: "bundle with failing verification",
        toolArtifact: {
          artifactId: "tool-fail-1",
          kind: "tool" as const,
          ref: "tool:fail",
        },
        bindingArtifact: {
          artifactId: "binding-fail-1",
          kind: "binding" as const,
          ref: "binding:fail",
        },
        verificationArtifact: {
          artifactId: "verification-fail-1",
          kind: "verification" as const,
          ref: "verify:fail",
        },
        usageArtifact: {
          artifactId: "usage-fail-1",
          kind: "usage" as const,
          ref: "usage:fail",
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
            adapterId: "adapter.fail",
          },
          adapterFactoryRef: "factory:fail",
        },
        replayRecommendation: {
          policy: "re_review_then_dispatch" as const,
          reason: "Review the failing verification first.",
          requiresReviewerApproval: true,
          suggestedTrigger: "after_review" as const,
        },
        metadata: {},
      };

      return defaultOutput;
    },
    clock: () => new Date("2026-03-31T10:20:00.000Z"),
    idFactory: () => `bundle-fail-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-failing-verification-1",
    sourceRequestId: "request-failing-verification-1",
    requestedCapabilityKey: "repo.write",
    reason: "Need a ready bundle with failing verification evidence.",
    createdAt: "2026-03-31T10:20:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const executorMetadata = bundle.metadata?.tmaExecutor as
    | { verificationEvidence?: Array<{ status?: string; summary?: string }> }
    | undefined;
  if (executorMetadata?.verificationEvidence?.[0]) {
    executorMetadata.verificationEvidence[0]!.status = "failed";
    executorMetadata.verificationEvidence[0]!.summary = "Smoke check failed after bundle build.";
  }
  const receipt = bundle.metadata?.tmaDeliveryReceipt as
    | {
      verificationSummary?: { total?: number; passed?: number; failed?: number; skipped?: number };
      verificationItems?: Array<{ status?: string; summary?: string }>;
      executionSummary?: { summary?: string };
    }
    | undefined;
  if (receipt?.verificationSummary) {
    receipt.verificationSummary = {
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
    };
  }
  if (receipt?.verificationItems?.[0]) {
    receipt.verificationItems[0]!.status = "failed";
    receipt.verificationItems[0]!.summary = "Smoke check failed after bundle build.";
  }
  if (receipt?.executionSummary) {
    receipt.executionSummary.summary = "Executor completed with failed smoke evidence.";
  }

  const report = runtime.createDeliveryReport(request.provisionId);

  assert.equal(report.status, "ready");
  assert.deepEqual(report.verificationSummary, {
    total: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
  });
  assert.equal(report.verificationItems?.[0]?.status, "failed");
  assert.equal(
    report.recommendedNextStep,
    "Bundle is ready but verification contains failures; tool reviewer should inspect the evidence before activation or replay planning.",
  );
  assert.match(report.summary, /Executor completed with failed smoke evidence/i);
});

test("provisioner runtime can serialize and restore durable state without losing bundle history order", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    clock: () => new Date("2026-03-25T10:00:00.000Z"),
    idFactory: () => `bundle-durable-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-durable-1",
    sourceRequestId: "request-durable-1",
    requestedCapabilityKey: "network.download",
    reason: "Need durable download capability record.",
    createdAt: "2026-03-25T10:00:00.000Z",
  });

  await runtime.submit(request);

  const snapshot = createProvisionerDurableSnapshot(runtime.serializeDurableState());
  const restored = createProvisionerRuntime();
  restored.restoreDurableState(snapshot);

  assert.deepEqual(
    restored.getBundleHistory(request.provisionId).map((bundle) => bundle.status),
    ["building", "ready"],
  );
  assert.equal(restored.registry.get(request.provisionId)?.bundle?.status, "ready");
  assert.equal(
    restored.assetIndex.getCurrent(request.provisionId)?.status,
    "ready_for_review",
  );
});

test("provisioner runtime restore keeps TMA sessions resumable without auto-submitting new work", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    clock: () => new Date("2026-03-25T10:30:00.000Z"),
    idFactory: () => `bundle-restore-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-restore-boundary-1",
    sourceRequestId: "request-restore-boundary-1",
    requestedCapabilityKey: "dependency.install",
    reason: "Keep restore boundary explicit.",
    createdAt: "2026-03-25T10:30:00.000Z",
    metadata: {
      approvedProvisionerLane: "extended",
    },
  });

  const bundle = await runtime.submit(request);
  const snapshot = createProvisionerDurableSnapshot(runtime.serializeDurableState());
  const restored = createProvisionerRuntime();
  restored.restoreDurableState(snapshot);

  assert.equal(bundle.status, "ready");
  assert.equal(restored.listTmaSessions().length >= 1, true);
  assert.equal(
    restored.listTmaSessions().every((session) => session.boundary.mayExecuteOriginalTask === false),
    true,
  );
  assert.equal(
    restored.listTmaSessions().some((session) => session.status === "resumable" || session.status === "completed"),
    true,
  );
  assert.deepEqual(
    restored.getBundleHistory(request.provisionId).map((entry) => entry.status),
    ["building", "ready"],
  );
});

test("provisioner runtime restore clamps tampered TMA session boundary back to capability_build_only", async () => {
  let counter = 0;
  const runtime = createProvisionerRuntime({
    clock: () => new Date("2026-03-25T10:45:00.000Z"),
    idFactory: () => `bundle-tampered-${++counter}`,
  });

  await runtime.submit(createProvisionRequest({
    provisionId: "provision-tampered-boundary-1",
    sourceRequestId: "request-tampered-boundary-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Create a resumable TMA snapshot first.",
    createdAt: "2026-03-25T10:45:00.000Z",
  }));

  const snapshot = createProvisionerDurableSnapshot(runtime.serializeDurableState());
  if (snapshot.tmaSessions?.[0]) {
    snapshot.tmaSessions[0] = {
      ...snapshot.tmaSessions[0],
      boundary: {
        mayExecuteOriginalTask: true as false,
        scope: "tampered_scope" as "capability_build_only",
      },
    };
  }

  const restored = createProvisionerRuntime();
  restored.restoreDurableState(snapshot);

  assert.equal(restored.listTmaSessions().length >= 1, true);
  assert.equal(restored.listTmaSessions()[0]?.boundary.mayExecuteOriginalTask, false);
  assert.equal(restored.listTmaSessions()[0]?.boundary.scope, "capability_build_only");
});

test("provisioner runtime can explicitly resume a resumable TMA session after restore", async () => {
  let failedOnce = true;
  const failing = createProvisionerRuntime({
    workerBridge: async () => {
      if (failedOnce) {
        failedOnce = false;
        throw new Error("planner boundary pause");
      }
      throw new Error("unexpected");
    },
    clock: () => new Date("2026-03-25T11:00:00.000Z"),
    idFactory: (() => {
      let counter = 0;
      return () => `bundle-resume-${++counter}`;
    })(),
  });

  const request = createProvisionRequest({
    provisionId: "provision-resume-tma-1",
    sourceRequestId: "request-resume-tma-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Leave a resumable TMA session first.",
    createdAt: "2026-03-25T11:00:00.000Z",
  });

  const failedBundle = await failing.submit(request);
  assert.equal(failedBundle.status, "failed");
  const snapshot = createProvisionerDurableSnapshot(failing.serializeDurableState());

  const restored = createProvisionerRuntime({
    clock: () => new Date("2026-03-25T11:00:10.000Z"),
    idFactory: (() => {
      let counter = 10;
      return () => `bundle-resume-${++counter}`;
    })(),
  });
  restored.restoreDurableState(snapshot);

  const resumable = restored.listResumableTmaSessions();
  assert.equal(resumable.length >= 1, true);

  const resumedBundle = await restored.resumeTmaSession(resumable[0]!.sessionId);

  assert.equal(resumedBundle?.status, "ready");
  assert.equal(
    (resumedBundle?.metadata?.tmaDeliveryReceipt as { resumedFromSessionId?: string } | undefined)?.resumedFromSessionId,
    resumable[0]!.sessionId,
  );
  assert.deepEqual(
    restored.getBundleHistory(request.provisionId).map((bundle) => bundle.status),
    ["building", "failed", "building", "ready"],
  );
  assert.equal(restored.listTmaSessions().some((session) => session.phase === "executor"), true);
  assert.equal(restored.listResumableTmaSessions().length, 0);
});
