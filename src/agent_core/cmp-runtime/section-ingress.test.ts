import assert from "node:assert/strict";
import test from "node:test";

import { createAgentLineage, createCmpBranchFamily } from "../cmp-types/index.js";
import {
  createCmpExactSectionFromMaterial,
  createCmpExactSectionsFromIngress,
  createCmpSectionIngressRecordFromIngress,
} from "./section-ingress.js";

test("section ingress converts ordinary runtime materials into exact runtime_context sections", () => {
  const section = createCmpExactSectionFromMaterial({
    projectId: "proj-cmp",
    agentId: "main",
    lineagePath: ["main"],
    material: {
      kind: "user_input",
      ref: "payload:user:1",
    },
    taskSummary: "sync current context",
    createdAt: "2026-03-25T00:00:00.000Z",
    sectionId: "section-main-user",
  });

  assert.equal(section.kind, "runtime_context");
  assert.equal(section.fidelity, "exact");
  assert.deepEqual(section.payloadRefs, ["payload:user:1"]);
  assert.ok(section.tags.includes("material:user_input"));
  assert.ok(section.tags.includes("section:runtime_context"));
});

test("section ingress maps context packages into exact section kinds by packageKind", () => {
  const childSeed = createCmpExactSectionFromMaterial({
    projectId: "proj-cmp",
    agentId: "child-a",
    lineagePath: ["main", "child-a"],
    material: {
      kind: "context_package",
      ref: "cmp-package:seed",
      metadata: {
        packageKind: "child_seed",
      },
    },
    taskSummary: "seed child agent",
    createdAt: "2026-03-25T00:01:00.000Z",
    sectionId: "section-child-seed",
  });
  const peerExchange = createCmpExactSectionFromMaterial({
    projectId: "proj-cmp",
    agentId: "peer-a",
    lineagePath: ["main", "peer-a"],
    material: {
      kind: "context_package",
      ref: "cmp-package:peer",
      metadata: {
        packageKind: "peer_exchange",
      },
    },
    taskSummary: "exchange with peer",
    createdAt: "2026-03-25T00:01:30.000Z",
    sectionId: "section-peer-exchange",
  });
  const historical = createCmpExactSectionFromMaterial({
    projectId: "proj-cmp",
    agentId: "main",
    lineagePath: ["main"],
    material: {
      kind: "context_package",
      ref: "cmp-package:history",
      metadata: {
        packageKind: "historical_reply",
      },
    },
    taskSummary: "load historical context",
    createdAt: "2026-03-25T00:02:00.000Z",
    sectionId: "section-historical",
  });

  assert.equal(childSeed.kind, "task_seed");
  assert.equal(peerExchange.kind, "peer_signal");
  assert.equal(historical.kind, "historical_context");
  assert.ok(childSeed.tags.includes("package:child_seed"));
  assert.ok(peerExchange.tags.includes("package:peer_exchange"));
  assert.ok(historical.tags.includes("package:historical_reply"));
});

test("section ingress derives lineage path from ancestor metadata and creates one exact section per material", () => {
  const lineage = createAgentLineage({
    agentId: "leaf",
    parentAgentId: "mid",
    depth: 2,
    projectId: "proj-cmp",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/leaf",
      cmpBranch: "cmp/leaf",
      mpBranch: "mp/leaf",
      tapBranch: "tap/leaf",
    }),
    metadata: {
      ancestorAgentIds: ["root", "mid"],
    },
  });

  const sections = createCmpExactSectionsFromIngress({
    ingest: {
      agentId: "leaf",
      sessionId: "session-1",
      runId: "run-1",
      lineage,
      taskSummary: "leaf ingest",
      materials: [
        {
          kind: "assistant_output",
          ref: "payload:assistant:1",
        },
        {
          kind: "context_package",
          ref: "cmp-package:promotion",
          metadata: {
            packageKind: "promotion_update",
          },
        },
      ],
    },
    createdAt: "2026-03-25T00:03:00.000Z",
    sectionIdFactory: (_material, index) => `section-${index + 1}`,
  });

  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0]?.lineagePath, ["root", "mid", "leaf"]);
  assert.equal(sections[0]?.kind, "runtime_context");
  assert.equal(sections[1]?.kind, "promotion_signal");
  assert.equal(sections[0]?.id, "section-1");
  assert.equal(sections[1]?.id, "section-2");
});

test("section ingress can build an ingress record and exact sections from one runtime ingest payload", () => {
  const lineage = createAgentLineage({
    agentId: "root",
    depth: 0,
    projectId: "proj-cmp",
    branchFamily: createCmpBranchFamily({
      workBranch: "work/root",
      cmpBranch: "cmp/root",
      mpBranch: "mp/root",
      tapBranch: "tap/root",
    }),
  });

  const record = createCmpSectionIngressRecordFromIngress({
    ingest: {
      agentId: "root",
      sessionId: "session-2",
      runId: "run-2",
      lineage,
      taskSummary: "capture exact context",
      materials: [
        {
          kind: "system_prompt",
          ref: "payload:system:1",
          metadata: {
            promptRole: "system",
          },
        },
        {
          kind: "context_package",
          ref: "cmp-package:child-seed",
          metadata: {
            packageKind: "child_seed",
          },
        },
      ],
      metadata: {
        ingressMode: "active",
      },
    },
    ingressId: "ingress-section-1",
    createdAt: "2026-03-25T00:04:00.000Z",
    payloadRefIndex: 1,
  });

  assert.equal(record.ingress.ingressId, "ingress-section-1");
  assert.equal(record.ingress.payloadRef.kind, "context_package");
  assert.equal(record.ingress.payloadRef.ref, "cmp-package:child-seed");
  assert.equal(record.sections.length, 2);
  assert.equal(record.sections[0]?.kind, "runtime_context");
  assert.equal(record.sections[1]?.kind, "task_seed");
  assert.equal(record.sections[0]?.metadata?.ingressMode, "active");
});
