import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_AGENT_LINEAGE_STATUSES,
  CMP_BRANCH_LAYERS,
  CMP_CHECKED_SNAPSHOT_QUALITY_LABELS,
  CMP_CONTEXT_EVENT_KINDS,
  CMP_CONTEXT_EVENT_SOURCES,
  CMP_CONTEXT_PACKAGE_FIDELITY_LABELS,
  CMP_CONTEXT_PACKAGE_KINDS,
  CMP_CONTEXT_SYNC_INTENTS,
  CMP_DISPATCH_STATUSES,
  CMP_DISPATCH_TARGET_KINDS,
  CMP_ESCALATION_SEVERITIES,
  CMP_INTERFACE_RESULT_STATUSES,
  CMP_PROJECTION_PROMOTION_STATUSES,
  CMP_PROJECTION_VISIBILITY_LEVELS,
  CMP_RUNTIME_CONTEXT_MATERIAL_KINDS,
  CMP_SNAPSHOT_CANDIDATE_STATUSES,
  CMP_SYNC_EVENT_CHANNELS,
  CMP_SYNC_EVENT_DIRECTIONS,
  createAgentLineage,
  createCheckedSnapshot,
  createCmpBranchFamily,
  createCommitContextDeltaInput,
  createContextDelta,
  createContextEvent,
  createContextPackage,
  createDispatchContextPackageInput,
  createDispatchReceipt,
  createEscalationAlert,
  createIngestRuntimeContextInput,
  createIngestRuntimeContextResult,
  createMaterializeContextPackageInput,
  createPromotedProjection,
  createRequestHistoricalContextInput,
  createResolveCheckedSnapshotInput,
  createSnapshotCandidate,
  createSyncEvent,
  validateDispatchReceipt,
} from "./index.js";
import {
  CMP_RULE_ACTIONS,
  CMP_SECTION_FIDELITY,
  CMP_SECTION_KINDS,
  CMP_SECTION_SOURCES,
  CMP_STORED_SECTION_PLANES,
  CMP_STORED_SECTION_STATES,
  createCmpRulePack,
  createCmpSection,
  createCmpStoredSectionFromSection,
  evaluateCmpRulePack,
} from "./cmp-section.js";

test("cmp protocol constants expose the frozen baseline enums", () => {
  assert.deepEqual(CMP_BRANCH_LAYERS, ["work", "cmp", "mp", "tap"]);
  assert.deepEqual(CMP_AGENT_LINEAGE_STATUSES, ["active", "paused", "completed", "archived"]);
  assert.deepEqual(CMP_CONTEXT_EVENT_KINDS, [
    "user_input",
    "system_prompt",
    "assistant_output",
    "tool_result",
    "state_marker",
    "context_package_received",
    "context_package_dispatched",
  ]);
  assert.deepEqual(CMP_CONTEXT_EVENT_SOURCES, ["core_agent", "icma", "dispatcher", "external_import"]);
  assert.deepEqual(CMP_CONTEXT_SYNC_INTENTS, [
    "local_record",
    "submit_to_parent",
    "broadcast_to_peers",
    "dispatch_to_children",
  ]);
  assert.deepEqual(CMP_SNAPSHOT_CANDIDATE_STATUSES, [
    "pending_check",
    "under_review",
    "accepted",
    "rejected",
    "superseded",
  ]);
  assert.deepEqual(CMP_CHECKED_SNAPSHOT_QUALITY_LABELS, ["usable", "preferred", "restricted"]);
  assert.deepEqual(CMP_PROJECTION_VISIBILITY_LEVELS, ["local", "parent", "peer", "children", "lineage"]);
  assert.deepEqual(CMP_PROJECTION_PROMOTION_STATUSES, [
    "local_only",
    "submitted_to_parent",
    "accepted_by_parent",
    "promoted_by_parent",
    "dispatched_downward",
    "archived",
  ]);
  assert.deepEqual(CMP_CONTEXT_PACKAGE_KINDS, [
    "active_reseed",
    "historical_reply",
    "peer_exchange",
    "promotion_update",
    "child_seed",
  ]);
  assert.deepEqual(CMP_CONTEXT_PACKAGE_FIDELITY_LABELS, [
    "high_signal",
    "checked_high_fidelity",
    "raw_linked",
  ]);
  assert.deepEqual(CMP_DISPATCH_STATUSES, ["queued", "delivered", "acknowledged", "rejected", "expired"]);
  assert.deepEqual(CMP_SYNC_EVENT_CHANNELS, ["git", "db", "mq"]);
  assert.deepEqual(CMP_SYNC_EVENT_DIRECTIONS, ["local", "to_parent", "to_peer", "to_children", "promotion"]);
  assert.deepEqual(CMP_ESCALATION_SEVERITIES, ["high", "critical"]);
  assert.deepEqual(CMP_RUNTIME_CONTEXT_MATERIAL_KINDS, [
    "user_input",
    "system_prompt",
    "assistant_output",
    "tool_result",
    "state_marker",
    "context_package",
  ]);
  assert.deepEqual(CMP_INTERFACE_RESULT_STATUSES, [
    "accepted",
    "resolved",
    "materialized",
    "dispatched",
    "not_found",
    "rejected",
  ]);
  assert.deepEqual(CMP_DISPATCH_TARGET_KINDS, ["core_agent", "parent", "peer", "child"]);
  assert.deepEqual(CMP_SECTION_KINDS, [
    "runtime_context",
    "historical_context",
    "task_seed",
    "peer_signal",
    "promotion_signal",
  ]);
  assert.deepEqual(CMP_SECTION_SOURCES, [
    "core_agent",
    "dispatcher",
    "parent_agent",
    "peer_agent",
    "child_agent",
    "system",
  ]);
  assert.deepEqual(CMP_SECTION_FIDELITY, ["exact", "checked", "projected"]);
  assert.deepEqual(CMP_STORED_SECTION_PLANES, ["git", "postgresql", "redis"]);
  assert.deepEqual(CMP_STORED_SECTION_STATES, [
    "stored",
    "checked",
    "promoted",
    "dispatched",
    "archived",
  ]);
  assert.deepEqual(CMP_RULE_ACTIONS, ["accept", "store", "promote", "dispatch", "defer", "drop"]);
});

test("cmp interface contracts normalize inputs without reaching into runtime assembly", () => {
  const lineage = createAgentLineage({
    agentId: "agent.main",
    depth: 0,
    projectId: "project.praxis",
    branchFamily: {
      workBranch: "work/main",
      cmpBranch: "cmp/main",
      mpBranch: "mp/main",
      tapBranch: "tap/main",
    },
  });

  const ingest = createIngestRuntimeContextInput({
    agentId: "agent.main",
    sessionId: "session-main",
    runId: "run-main",
    lineage,
    taskSummary: "Capture the latest runtime context for CMP active flow.",
    materials: [
      { kind: "system_prompt", ref: "git:cmp/main#system" },
      { kind: "assistant_output", ref: "git:cmp/main#answer" },
    ],
    requiresActiveSync: true,
  });
  const ingestResult = createIngestRuntimeContextResult({
    status: "accepted",
    acceptedEventIds: ["event-1", "event-1", "event-2"],
    nextAction: "commit_context_delta",
  });
  const commitInput = createCommitContextDeltaInput({
    agentId: "agent.main",
    sessionId: "session-main",
    runId: "run-main",
    eventIds: ingestResult.acceptedEventIds,
    changeSummary: "Promote the newly accepted runtime context events.",
    syncIntent: "submit_to_parent",
  });
  const resolveInput = createResolveCheckedSnapshotInput({
    agentId: "agent.main",
    projectId: "project.praxis",
    branchRef: "cmp/main",
  });
  const materializeInput = createMaterializeContextPackageInput({
    agentId: "agent.main",
    snapshotId: "snapshot-1",
    targetAgentId: "agent.child",
    packageKind: "child_seed",
  });
  const dispatchInput = createDispatchContextPackageInput({
    agentId: "agent.main",
    packageId: "package-1",
    sourceAgentId: "agent.main",
    targetAgentId: "agent.child",
    targetKind: "child",
  });
  const historicalInput = createRequestHistoricalContextInput({
    requesterAgentId: "agent.main",
    projectId: "project.praxis",
    reason: "Need the latest checked context package for a passive readback.",
    query: {
      lineageRef: "lineage:agent.main",
      packageKindHint: "historical_reply",
    },
  });

  assert.equal(ingest.materials.length, 2);
  assert.deepEqual(ingestResult.acceptedEventIds, ["event-1", "event-2"]);
  assert.equal(commitInput.eventIds.length, 2);
  assert.equal(resolveInput.branchRef, "cmp/main");
  assert.equal(materializeInput.packageKind, "child_seed");
  assert.equal(dispatchInput.targetKind, "child");
  assert.equal(historicalInput.query.packageKindHint, "historical_reply");
});

test("cmp context pipeline objects keep fact, checked, projection, and delivery layers separate", () => {
  const contextEvent = createContextEvent({
    eventId: "event-1",
    agentId: "agent.main",
    sessionId: "session-main",
    runId: "run-main",
    kind: "assistant_output",
    payloadRef: "git:cmp/main#evt-1",
    createdAt: "2026-03-20T01:00:00.000Z",
    source: "icma",
  });
  const delta = createContextDelta({
    deltaId: "delta-1",
    agentId: contextEvent.agentId,
    baseRef: "cmp/main~1",
    eventRefs: [contextEvent.eventId],
    changeSummary: "Main agent produced a new checked answer segment.",
    createdAt: "2026-03-20T01:00:01.000Z",
    syncIntent: "submit_to_parent",
  });
  const candidate = createSnapshotCandidate({
    candidateId: "candidate-1",
    agentId: contextEvent.agentId,
    branchRef: "cmp/main",
    commitRef: "abc123",
    deltaRefs: [delta.deltaId],
    createdAt: "2026-03-20T01:00:02.000Z",
  });
  const snapshot = createCheckedSnapshot({
    snapshotId: "snapshot-1",
    agentId: contextEvent.agentId,
    lineageRef: "lineage:agent.main",
    branchRef: candidate.branchRef,
    commitRef: candidate.commitRef,
    checkedAt: "2026-03-20T01:00:03.000Z",
    qualityLabel: "preferred",
  });
  const projection = createPromotedProjection({
    projectionId: "projection-1",
    snapshotId: snapshot.snapshotId,
    agentId: snapshot.agentId,
    visibilityLevel: "parent",
    promotionStatus: "promoted_by_parent",
    projectionRefs: ["db:cmp/projection-1"],
    updatedAt: "2026-03-20T01:00:04.000Z",
  });
  const contextPackage = createContextPackage({
    packageId: "package-1",
    sourceProjectionId: projection.projectionId,
    targetAgentId: "agent.child",
    packageKind: "child_seed",
    packageRef: "db:cmp/package-1",
    createdAt: "2026-03-20T01:00:05.000Z",
  });

  assert.equal(candidate.status, "pending_check");
  assert.equal(snapshot.promotable, true);
  assert.equal(projection.promotionStatus, "promoted_by_parent");
  assert.equal(contextPackage.fidelityLabel, "checked_high_fidelity");
});

test("dispatch, sync, and escalation objects preserve neighborhood delivery boundaries", () => {
  const receipt = createDispatchReceipt({
    dispatchId: "dispatch-1",
    packageId: "package-1",
    sourceAgentId: "agent.main",
    targetAgentId: "agent.peer",
    status: "delivered",
    deliveredAt: "2026-03-20T01:10:00.000Z",
    acknowledgedAt: "2026-03-20T01:10:03.000Z",
  });
  const syncEvent = createSyncEvent({
    syncEventId: "sync-1",
    agentId: "agent.main",
    channel: "mq",
    direction: "to_peer",
    objectRef: receipt.dispatchId,
    createdAt: "2026-03-20T01:10:04.000Z",
  });
  const alert = createEscalationAlert({
    alertId: "alert-1",
    sourceAgentId: "agent.grandchild",
    targetAncestorId: "agent.root",
    reason: "Parent lineage is unavailable and checked state may be corrupted.",
    evidenceRef: "git:cmp/agent.grandchild#critical-1",
    createdAt: "2026-03-20T01:10:05.000Z",
  });

  validateDispatchReceipt(receipt);
  assert.equal(syncEvent.direction, "to_peer");
  assert.equal(alert.severity, "critical");
});

test("cmp section primitives can derive stored sections and evaluate rules", () => {
  const section = createCmpSection({
    id: "section-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.root", "agent.main"],
    source: "core_agent",
    kind: "task_seed",
    fidelity: "exact",
    payloadRefs: ["payload:seed-1"],
    tags: ["context_package", "task_seed"],
    createdAt: "2026-03-25T01:00:00.000Z",
  });
  const stored = createCmpStoredSectionFromSection({
    storedSectionId: "stored-1",
    section,
    plane: "git",
    storageRef: "git:section-1",
    state: "promoted",
    persistedAt: "2026-03-25T01:00:01.000Z",
  });
  const pack = createCmpRulePack({
    id: "pack-1",
    name: "task-seed-pack",
    rules: [
      {
        id: "rule-promote-task-seed",
        name: "Promote task seed",
        action: "promote",
        priority: 10,
        sectionKinds: ["task_seed"],
      },
    ],
  });
  const evaluation = evaluateCmpRulePack({
    pack,
    section,
  });

  assert.equal(stored.sourceSectionId, section.id);
  assert.equal(stored.state, "promoted");
  assert.equal(evaluation.recommendedAction, "promote");
});
