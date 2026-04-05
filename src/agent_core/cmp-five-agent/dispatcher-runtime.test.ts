import assert from "node:assert/strict";
import test from "node:test";

import {
  createContextPackage,
  createDispatchReceipt,
  createRequestHistoricalContextInput,
} from "../cmp-types/index.js";
import { createCmpDispatcherRuntime } from "./dispatcher-runtime.js";

test("CmpDispatcherRuntime records child seed via child ICMA and peer approval state", () => {
  const runtime = createCmpDispatcherRuntime();
  const child = runtime.dispatch({
    contextPackage: createContextPackage({
      packageId: "pkg-child",
      sourceProjectionId: "projection-1",
      targetAgentId: "child-a",
      packageKind: "child_seed",
      packageRef: "cmp-package:child",
      metadata: {
        cmpGuideRef: "guide:child",
        cmpBackgroundRef: "background:child",
        cmpTimelinePackageId: "timeline:child",
        cmpTaskSnapshotIds: ["task:child:1"],
      },
      createdAt: "2026-03-25T00:00:00.000Z",
    }),
    dispatch: {
      agentId: "main",
      packageId: "pkg-child",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      targetKind: "child",
    },
    receipt: createDispatchReceipt({
      dispatchId: "dispatch-child",
      packageId: "pkg-child",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      status: "delivered",
      deliveredAt: "2026-03-25T00:00:00.000Z",
    }),
    createdAt: "2026-03-25T00:00:00.000Z",
    loopId: "dispatcher-child-1",
  });
  assert.equal(child.loop.packageMode, "child_seed_via_icma");
  assert.deepEqual(child.loop.metadata?.routePolicy, {
    targetKind: "child",
    packageMode: "child_seed_via_icma",
    targetIngress: "child_icma_only",
    childSeedPolicy: {
      enforced: true,
      requiredIngress: "child_icma_only",
    },
  });
  assert.deepEqual(child.loop.bundle.body, {
    packageId: "pkg-child",
    packageKind: "child_seed",
    primaryRef: "cmp-package:child",
    guideRef: "guide:child",
    backgroundRef: "background:child",
    taskSnapshotRefs: [],
    bodyStrategy: "child_seed_full",
  });
  assert.deepEqual(child.loop.bundle.sourceAnchorRefs, [
    "cmp-package:child",
    "guide:child",
    "background:child",
  ]);
  assert.deepEqual(child.loop.metadata?.packageDiscipline, {
    packageMode: "child_seed_via_icma",
    payloadClass: "child_seed_bundle",
    includeGuideRef: true,
    includeBackgroundRef: true,
    includeTimelineRef: false,
    includeTaskSnapshots: false,
    mustEnter: "child_icma_only",
  });

  const peer = runtime.dispatch({
    contextPackage: createContextPackage({
      packageId: "pkg-peer",
      sourceProjectionId: "projection-2",
      targetAgentId: "peer-b",
      packageKind: "peer_exchange",
      packageRef: "cmp-package:peer",
      metadata: {
        cmpGuideRef: "guide:peer",
        cmpBackgroundRef: "background:peer",
        cmpTimelinePackageId: "timeline:peer",
        cmpTaskSnapshotIds: ["task:peer:1"],
      },
      createdAt: "2026-03-25T00:00:00.000Z",
    }),
    dispatch: {
      agentId: "peer-a",
      packageId: "pkg-peer",
      sourceAgentId: "peer-a",
      targetAgentId: "peer-b",
      targetKind: "peer",
      metadata: {
        parentAgentId: "parent-a",
        currentStateSummary: "peer exchange needs parent approval before delivery",
        sourceRequestId: "request-peer-1",
        sourceSnapshotId: "snapshot-peer-1",
      },
    },
    receipt: createDispatchReceipt({
      dispatchId: "dispatch-peer",
      packageId: "pkg-peer",
      sourceAgentId: "peer-a",
      targetAgentId: "peer-b",
      status: "delivered",
      deliveredAt: "2026-03-25T00:00:00.000Z",
    }),
    createdAt: "2026-03-25T00:00:00.000Z",
    loopId: "dispatcher-peer-1",
  });
  assert.equal(peer.peerApproval?.status, "pending_parent_core_approval");
  assert.equal(peer.loop.bundle.governance.sourceRequestId, "request-peer-1");
  assert.equal(peer.loop.bundle.governance.sourceSnapshotId, "snapshot-peer-1");
  assert.equal(peer.loop.bundle.governance.scopePolicy, "peer_exchange_requires_explicit_parent_approval");
  assert.equal(peer.loop.bundle.target.targetIngress, "peer_exchange");
  assert.equal(peer.loop.bundle.body.primaryRef, "cmp-package:peer");
  assert.deepEqual(peer.loop.bundle.body, {
    packageId: "pkg-peer",
    packageKind: "peer_exchange",
    primaryRef: "cmp-package:peer",
    taskSnapshotRefs: [],
    bodyStrategy: "peer_exchange_slim",
    slimExchangeFields: ["packageId", "packageKind", "primaryRef"],
  });
  assert.deepEqual(peer.loop.bundle.sourceAnchorRefs, [
    "cmp-package:peer",
    "snapshot-peer-1",
  ]);
  assert.deepEqual(peer.peerApproval?.metadata?.approval, {
    explicit: true,
    status: "pending_parent_core_approval",
    approvalChain: "parent_dbagent_then_parent_core_agent",
    mode: "explicit_once",
  });
  assert.deepEqual(peer.loop.metadata?.routePolicy, {
    targetKind: "peer",
    packageMode: "peer_exchange_slim",
    targetIngress: "peer_exchange",
    peerApprovalRequired: true,
    approvalId: peer.peerApproval?.approvalId,
    approvalStatus: "pending_parent_core_approval",
    approvalChain: "parent_dbagent_then_parent_core_agent",
  });
  assert.deepEqual(peer.loop.metadata?.packageDiscipline, {
    packageMode: "peer_exchange_slim",
    payloadClass: "peer_slim_exchange_bundle",
    includeGuideRef: false,
    includeBackgroundRef: false,
    includeTimelineRef: false,
    includeTaskSnapshots: false,
    allowedFields: ["packageId", "packageKind", "primaryRef"],
  });
});

test("CmpDispatcherRuntime persists explicit peer approval decisions in stable fields", () => {
  const runtime = createCmpDispatcherRuntime();
  const dispatched = runtime.dispatch({
    contextPackage: createContextPackage({
      packageId: "pkg-peer-2",
      sourceProjectionId: "projection-3",
      targetAgentId: "peer-c",
      packageKind: "peer_exchange",
      packageRef: "cmp-package:peer-2",
      createdAt: "2026-03-25T00:01:00.000Z",
    }),
    dispatch: {
      agentId: "peer-b",
      packageId: "pkg-peer-2",
      sourceAgentId: "peer-b",
      targetAgentId: "peer-c",
      targetKind: "peer",
      metadata: {
        parentAgentId: "parent-b",
        currentStateSummary: "peer package awaits approval",
      },
    },
    receipt: createDispatchReceipt({
      dispatchId: "dispatch-peer-2",
      packageId: "pkg-peer-2",
      sourceAgentId: "peer-b",
      targetAgentId: "peer-c",
      status: "delivered",
      deliveredAt: "2026-03-25T00:01:00.000Z",
    }),
    createdAt: "2026-03-25T00:01:00.000Z",
    loopId: "dispatcher-peer-2",
  });
  const approvalId = dispatched.peerApproval?.approvalId;
  assert.ok(approvalId);

  const approved = runtime.approvePeerExchange({
    approvalId,
    actorAgentId: "parent-b",
    decision: "approved",
    decidedAt: "2026-03-25T00:02:00.000Z",
    note: "allow one-time peer exchange",
  });

  assert.equal(approved.status, "approved");
  assert.deepEqual(approved.metadata?.approval, {
    explicit: true,
    status: "approved",
    approvalChain: "parent_dbagent_then_parent_core_agent",
    mode: "explicit_once",
    decidedAt: "2026-03-25T00:02:00.000Z",
    decidedByAgentId: "parent-b",
    decisionNote: "allow one-time peer exchange",
  });
  const updatedLoop = runtime.createSnapshot("peer-b").records.find((record) => record.loopId === "dispatcher-peer-2");
  assert.deepEqual(updatedLoop?.metadata?.routePolicy, {
    targetKind: "peer",
    packageMode: "peer_exchange_slim",
    targetIngress: "peer_exchange",
    peerApprovalRequired: true,
    approvalId,
    approvalStatus: "approved",
    approvalChain: "parent_dbagent_then_parent_core_agent",
  });
  assert.equal(updatedLoop?.bundle.governance.approvalStatus, "approved");
});

test("CmpDispatcherRuntime dispatchWithLlm writes route rationale and supports fallback", async () => {
  const runtime = createCmpDispatcherRuntime();
  const input = {
    contextPackage: createContextPackage({
      packageId: "pkg-live",
      sourceProjectionId: "projection-live",
      targetAgentId: "child-live",
      packageKind: "child_seed",
      packageRef: "cmp-package:live",
      createdAt: "2026-03-30T00:00:00.000Z",
    }),
    dispatch: {
      agentId: "main-live",
      packageId: "pkg-live",
      sourceAgentId: "main-live",
      targetAgentId: "child-live",
      targetKind: "child" as const,
      metadata: {
        sourceRequestId: "request-live",
        sourceSnapshotId: "snapshot-live",
      },
    },
    receipt: createDispatchReceipt({
      dispatchId: "dispatch-live",
      packageId: "pkg-live",
      sourceAgentId: "main-live",
      targetAgentId: "child-live",
      status: "delivered",
      deliveredAt: "2026-03-30T00:00:00.000Z",
    }),
    createdAt: "2026-03-30T00:00:00.000Z",
    loopId: "dispatcher-live",
  };

  const live = await runtime.dispatchWithLlm(input, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        routeRationale: "这是一个标准 child seed，应继续只进入 child ICMA。",
        bodyStrategy: "child_seed_full",
        scopePolicy: "child_seed_only_enters_child_icma",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-dispatcher-live",
    }),
  });
  assert.equal(live.loop.bundle.governance.routeRationale, "这是一个标准 child seed，应继续只进入 child ICMA。");
  assert.equal(live.loop.bundle.governance.scopePolicy, "child_seed_only_enters_child_icma");
  assert.equal(live.loop.bundle.body.bodyStrategy, "child_seed_full");
  assert.equal(live.loop.liveTrace?.status, "live_applied");
  assert.equal(live.loop.liveTrace?.provider, "openai");
  assert.equal((live.loop.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");
  assert.equal(live.loop.metadata?.routeRationale, "这是一个标准 child seed，应继续只进入 child ICMA。");

  const fallback = await runtime.dispatchWithLlm({
    ...input,
    loopId: "dispatcher-fallback",
    receipt: createDispatchReceipt({
      dispatchId: "dispatch-fallback",
      packageId: "pkg-live",
      sourceAgentId: "main-live",
      targetAgentId: "child-live",
      status: "delivered",
      deliveredAt: "2026-03-30T00:00:01.000Z",
    }),
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("gateway failed");
    },
  });
  assert.equal(fallback.loop.bundle.governance.routeRationale, undefined);
  assert.equal(fallback.loop.bundle.governance.scopePolicy, "child_seed_only_enters_child_icma");
  assert.equal(fallback.loop.bundle.body.bodyStrategy, "child_seed_full");
  assert.equal(fallback.loop.liveTrace?.status, "fallback_rules");
  assert.equal((fallback.loop.metadata?.liveLlm as { status?: string; fallbackApplied?: boolean } | undefined)?.status, "fallback");
  assert.equal((fallback.loop.metadata?.liveLlm as { fallbackApplied?: boolean } | undefined)?.fallbackApplied, true);

  await assert.rejects(
    () => runtime.dispatchWithLlm({
      ...input,
      loopId: "dispatcher-required",
      receipt: createDispatchReceipt({
        dispatchId: "dispatch-required",
        packageId: "pkg-live",
        sourceAgentId: "main-live",
        targetAgentId: "child-live",
        status: "delivered",
        deliveredAt: "2026-03-30T00:00:02.000Z",
      }),
    }, {
      mode: "llm_required",
      executor: async () => {
        throw new Error("hard fail");
      },
    }),
    /hard fail/u,
  );
});

test("CmpDispatcherRuntime deliverPassiveReturnWithLlm keeps passive return topology and route rationale", async () => {
  const runtime = createCmpDispatcherRuntime();
  const input = {
    request: createRequestHistoricalContextInput({
      requesterAgentId: "main-passive",
      projectId: "proj-passive",
      reason: "回看最近历史",
      query: {
        snapshotId: "snapshot-passive",
        branchRef: "refs/heads/cmp/main-passive",
      },
    }),
    contextPackage: createContextPackage({
      packageId: "pkg-passive",
      sourceProjectionId: "projection-passive",
      targetAgentId: "main-passive",
      packageKind: "historical_reply",
      packageRef: "cmp-package:passive",
      fidelityLabel: "checked_high_fidelity",
      metadata: {
        cmpTimelinePackageId: "timeline:passive",
        cmpTaskSnapshotIds: ["task:passive:1", "task:passive:2"],
        cmpGuideRef: "guide:passive",
        cmpBackgroundRef: "background:passive",
      },
      createdAt: "2026-03-30T00:10:00.000Z",
    }),
    createdAt: "2026-03-30T00:10:00.000Z",
    loopId: "dispatcher-passive-live",
  } as const;

  const live = await runtime.deliverPassiveReturnWithLlm(input, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        routeRationale: "这是一次被动历史回送，应沿 core_agent_return 返回主 agent。",
        bodyStrategy: "historical_return",
        scopePolicy: "historical_reply_returns_via_core_path",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-dispatcher-passive-live",
    }),
  });

  assert.equal(live.packageMode, "historical_reply_return");
  assert.equal(live.bundle.target.targetIngress, "core_agent_return");
  assert.deepEqual(live.bundle.body, {
    packageId: "pkg-passive",
    packageKind: "historical_reply",
    primaryRef: "cmp-package:passive",
    timelineRef: "timeline:passive",
    taskSnapshotRefs: ["task:passive:1", "task:passive:2"],
    bodyStrategy: "historical_return",
  });
  assert.deepEqual(live.bundle.sourceAnchorRefs, [
    "cmp-package:passive",
    "timeline:passive",
    "task:passive:1",
    "task:passive:2",
  ]);
  assert.equal(live.bundle.governance.routeRationale, "这是一次被动历史回送，应沿 core_agent_return 返回主 agent。");
  assert.equal(live.bundle.governance.scopePolicy, "historical_reply_returns_via_core_path");
  assert.equal(live.liveTrace?.status, "live_applied");
  assert.equal((live.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");
  assert.deepEqual(live.metadata?.packageDiscipline, {
    packageMode: "historical_reply_return",
    payloadClass: "historical_return_bundle",
    includeGuideRef: false,
    includeBackgroundRef: false,
    includeTimelineRef: true,
    includeTaskSnapshots: true,
    mustReturnVia: "core_agent_return",
  });

  const fallback = await runtime.deliverPassiveReturnWithLlm({
    ...input,
    loopId: "dispatcher-passive-fallback",
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("dispatcher passive gateway failed");
    },
  });

  assert.equal(fallback.packageMode, "historical_reply_return");
  assert.equal(fallback.bundle.governance.routeRationale, undefined);
  assert.equal(fallback.bundle.governance.scopePolicy, "historical_reply_returns_via_core_path");
  assert.equal(fallback.liveTrace?.status, "fallback_rules");
  assert.equal((fallback.metadata?.liveLlm as { status?: string; fallbackApplied?: boolean } | undefined)?.status, "fallback");
  assert.equal((fallback.metadata?.liveLlm as { fallbackApplied?: boolean } | undefined)?.fallbackApplied, true);
});
