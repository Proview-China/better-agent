import assert from "node:assert/strict";
import test from "node:test";

import { createAgentLineage, createCmpBranchFamily } from "../cmp-types/index.js";
import { createCmpRulePack } from "../cmp-types/cmp-section.js";
import {
  createCmpContextPackageRecordFromStoredSection,
  createCmpProjectionAndPackageRecordsFromStoredSection,
  createCmpProjectionRecordFromStoredSection,
} from "./materialization.js";
import { createCmpSectionIngressRecord } from "./ingress-contract.js";
import {
  createCmpSectionsFromIngest,
  lowerCmpSectionIngressRecordWithRulePack,
  lowerCmpSectionsWithRulePack,
} from "./section-rules.js";

test("section-rules can lower ingest materials into exact sections and stored sections", () => {
  const lineage = createAgentLineage({
    agentId: "main",
    depth: 0,
    projectId: "cmp-project",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/main",
      cmpBranch: "cmp/main",
      mpBranch: "mp/main",
      tapBranch: "tap/main",
    }),
  });

  const sections = createCmpSectionsFromIngest({
    projectId: "cmp-project",
    lineage,
    createdAt: "2026-03-25T00:00:00.000Z",
    materials: [
      { kind: "user_input", ref: "payload:user-1" },
      { kind: "context_package", ref: "payload:seed-1" },
    ],
  });

  assert.equal(sections.length, 2);
  assert.equal(sections[0]?.kind, "runtime_context");
  assert.equal(sections[0]?.fidelity, "exact");
  assert.equal(sections[1]?.kind, "task_seed");

  const pack = createCmpRulePack({
    id: "pack-1",
    name: "default-section-pack",
    rules: [
      {
        id: "rule-seed-promote",
        name: "Promote task seed",
        action: "promote",
        priority: 20,
        sectionKinds: ["task_seed"],
      },
      {
        id: "rule-store-runtime",
        name: "Store runtime context",
        action: "store",
        priority: 10,
        sectionKinds: ["runtime_context"],
      },
    ],
  });

  const lowered = lowerCmpSectionsWithRulePack({
    sections,
    pack,
    plane: "git",
    persistedAt: "2026-03-25T00:00:01.000Z",
  });

  assert.equal(lowered.length, 2);
  assert.equal(lowered[0]?.evaluation.recommendedAction, "store");
  assert.equal(lowered[0]?.storedSection?.state, "stored");
  assert.equal(lowered[1]?.evaluation.recommendedAction, "promote");
  assert.equal(lowered[1]?.storedSection?.state, "promoted");

  const ingressRecord = createCmpSectionIngressRecord({
    ingress: {
      ingressId: "ingress-1",
      lineage: {
        projectId: "cmp-project",
        agentId: "main",
        depth: 0,
      },
      sessionId: "session-1",
      runId: "run-1",
      payloadRef: {
        ref: "payload:user-1",
        kind: "context_event",
      },
      granularityLabel: "high-signal",
      createdAt: "2026-03-25T00:00:00.000Z",
      source: "core_agent",
    },
    sections,
  });
  assert.equal(ingressRecord.sections.length, 2);
});

test("section-rules can derive projection and package records from stored sections", () => {
  const lineage = createAgentLineage({
    agentId: "main",
    depth: 0,
    projectId: "cmp-project",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/main",
      cmpBranch: "cmp/main",
      mpBranch: "mp/main",
      tapBranch: "tap/main",
    }),
  });
  const [section] = createCmpSectionsFromIngest({
    projectId: "cmp-project",
    lineage,
    createdAt: "2026-03-25T00:05:00.000Z",
    materials: [
      { kind: "context_package", ref: "payload:seed-1" },
    ],
  });
  if (!section) {
    throw new Error("Expected one section.");
  }
  const pack = createCmpRulePack({
    id: "pack-2",
    name: "promote-only-pack",
    rules: [
      {
        id: "rule-promote",
        name: "Promote task seed",
        action: "promote",
        priority: 10,
        sectionKinds: ["task_seed"],
      },
    ],
  });
  const [lowered] = lowerCmpSectionsWithRulePack({
    sections: [section],
    pack,
    plane: "postgresql",
    persistedAt: "2026-03-25T00:05:01.000Z",
  });
  if (!lowered?.storedSection) {
    throw new Error("Expected stored section.");
  }

  const projection = createCmpProjectionRecordFromStoredSection({
    projectionId: "projection-1",
    checkedSnapshotRef: "checked:1",
    storedSection: lowered.storedSection,
    visibility: "promoted_by_parent",
    updatedAt: "2026-03-25T00:05:02.000Z",
  });
  const pkg = createCmpContextPackageRecordFromStoredSection({
    packageId: "pkg-1",
    projectionId: projection.projectionId,
    storedSection: lowered.storedSection,
    targetAgentId: "child-1",
    packageKind: "child_seed",
    packageRef: "cmp-package:seed-1",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T00:05:03.000Z",
  });

  assert.equal(projection.agentId, "main");
  assert.equal(pkg.sourceAgentId, "main");
  assert.equal(pkg.targetAgentId, "child-1");
  assert.equal(pkg.metadata?.storedState, "promoted");
});

test("section-rules preserve packageKind-driven section kinds when wrapping exact ingress creation", () => {
  const lineage = createAgentLineage({
    agentId: "peer-a",
    parentAgentId: "main",
    depth: 1,
    projectId: "cmp-project",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/peer-a",
      cmpBranch: "cmp/peer-a",
      mpBranch: "mp/peer-a",
      tapBranch: "tap/peer-a",
    }),
    metadata: {
      ancestorAgentIds: ["main"],
    },
  });

  const sections = createCmpSectionsFromIngest({
    projectId: "cmp-project",
    lineage,
    createdAt: "2026-03-25T00:06:00.000Z",
    tags: ["high-signal"],
    materials: [
      {
        kind: "context_package",
        ref: "payload:peer-1",
        metadata: {
          packageKind: "peer_exchange",
        },
      },
      {
        kind: "context_package",
        ref: "payload:history-1",
        metadata: {
          packageKind: "historical_reply",
        },
      },
    ],
  });

  assert.equal(sections[0]?.kind, "peer_signal");
  assert.equal(sections[1]?.kind, "historical_context");
  assert.ok(sections[0]?.tags.includes("high-signal"));
  assert.ok(sections[1]?.tags.includes("high-signal"));
});

test("section-rules can lower a section ingress record and summarize stored vs dropped sections", () => {
  const pack = createCmpRulePack({
    id: "pack-3",
    name: "drop noisy store runtime",
    rules: [
      {
        id: "rule-store-runtime",
        name: "Store runtime context",
        action: "store",
        priority: 20,
        sectionKinds: ["runtime_context"],
      },
      {
        id: "rule-drop-peer",
        name: "Drop peer signal",
        action: "drop",
        priority: 30,
        sectionKinds: ["peer_signal"],
      },
    ],
  });

  const record = createCmpSectionIngressRecord({
    ingress: {
      ingressId: "ingress-2",
      lineage: {
        projectId: "cmp-project",
        agentId: "main",
        depth: 0,
      },
      sessionId: "session-2",
      runId: "run-2",
      payloadRef: {
        ref: "payload:user-2",
        kind: "user_input",
      },
      granularityLabel: "section-first",
      createdAt: "2026-03-25T00:06:30.000Z",
      source: "core_agent",
    },
    sections: [
      {
        id: "section-runtime",
        projectId: "cmp-project",
        agentId: "main",
        lineagePath: ["main"],
        source: "core_agent",
        kind: "runtime_context",
        fidelity: "exact",
        payloadRefs: ["payload:user-2"],
        tags: ["material:user_input"],
        createdAt: "2026-03-25T00:06:30.000Z",
      },
      {
        id: "section-peer",
        projectId: "cmp-project",
        agentId: "main",
        lineagePath: ["main"],
        source: "peer_agent",
        kind: "peer_signal",
        fidelity: "exact",
        payloadRefs: ["payload:peer-2"],
        tags: ["material:context_package"],
        createdAt: "2026-03-25T00:06:31.000Z",
      },
    ],
  });

  const lowered = lowerCmpSectionIngressRecordWithRulePack({
    record,
    pack,
    plane: "git",
    persistedAt: "2026-03-25T00:06:32.000Z",
  });

  assert.equal(lowered.lowered.length, 2);
  assert.equal(lowered.storedSections.length, 1);
  assert.deepEqual(lowered.droppedSectionIds, ["section-peer"]);
  assert.equal(lowered.storedSections[0]?.sourceSectionId, "section-runtime");
});

test("section-rules can derive projection and package together from one stored section", () => {
  const storedSection = {
    id: "stored-1",
    projectId: "cmp-project",
    agentId: "main",
    sourceSectionId: "section-1",
    plane: "postgresql" as const,
    storageRef: "postgresql:section:1",
    state: "promoted" as const,
    visibility: "parent" as const,
    persistedAt: "2026-03-25T00:07:00.000Z",
    updatedAt: "2026-03-25T00:07:00.000Z",
  };

  const records = createCmpProjectionAndPackageRecordsFromStoredSection({
    projectionId: "projection-2",
    checkedSnapshotRef: "checked:2",
    storedSection,
    visibility: "promoted_by_parent",
    updatedAt: "2026-03-25T00:07:01.000Z",
    packageId: "pkg-2",
    targetAgentId: "child-2",
    packageKind: "child_seed",
    packageRef: "cmp-package:seed-2",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T00:07:02.000Z",
    projectionMetadata: {
      source: "section-first",
    },
    packageMetadata: {
      source: "section-first",
    },
  });

  assert.equal(records.projection.projectionId, "projection-2");
  assert.equal(records.contextPackage.projectionId, "projection-2");
  assert.equal(records.contextPackage.metadata?.storedSectionId, "stored-1");
  assert.equal(records.contextPackage.metadata?.source, "section-first");
});
