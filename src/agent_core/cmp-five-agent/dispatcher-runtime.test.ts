import assert from "node:assert/strict";
import test from "node:test";

import { createContextPackage, createDispatchReceipt } from "../cmp-types/index.js";
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

  const peer = runtime.dispatch({
    contextPackage: createContextPackage({
      packageId: "pkg-peer",
      sourceProjectionId: "projection-2",
      targetAgentId: "peer-b",
      packageKind: "peer_exchange",
      packageRef: "cmp-package:peer",
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
  assert.equal(peer.loop.bundle.target.targetIngress, "peer_exchange");
  assert.equal(peer.loop.bundle.body.primaryRef, "cmp-package:peer");
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
