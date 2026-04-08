import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMpPromotionAllowed,
  assertMpScopeVisibleToTarget,
  evaluateMpPromotionAllowed,
  evaluateMpScopeAccess,
  resolveMpLineageRelation,
} from "./scope-enforcement.js";

const root = {
  projectId: "project-a",
  agentId: "root",
  depth: 0,
  childAgentIds: ["child-a", "child-b"],
};

const childA = {
  projectId: "project-a",
  agentId: "child-a",
  parentAgentId: "root",
  depth: 1,
  childAgentIds: ["grandchild-a1"],
  peerAgentIds: ["child-b"],
};

const childB = {
  projectId: "project-a",
  agentId: "child-b",
  parentAgentId: "root",
  depth: 1,
  peerAgentIds: ["child-a"],
};

const grandchildA1 = {
  projectId: "project-a",
  agentId: "grandchild-a1",
  parentAgentId: "child-a",
  depth: 2,
  metadata: {
    ancestorAgentIds: ["root"],
  },
};

const distantOtherProject = {
  projectId: "project-b",
  agentId: "other-root",
  depth: 0,
};

test("mp lineage relation resolves parent peer child and ancestor correctly", () => {
  assert.equal(resolveMpLineageRelation({ source: childA, target: root }), "parent");
  assert.equal(resolveMpLineageRelation({ source: root, target: childA }), "child");
  assert.equal(resolveMpLineageRelation({ source: childA, target: childB }), "peer");
  assert.equal(resolveMpLineageRelation({ source: grandchildA1, target: root }), "ancestor");
});

test("mp scope access keeps agent-isolated memory self-only and project memory same-project wide", () => {
  const localDecision = evaluateMpScopeAccess({
    memory: {
      memoryId: "memory-local",
      projectId: "project-a",
      agentId: "child-a",
      scopeLevel: "agent_isolated",
      sessionMode: "isolated",
      visibilityState: "local_only",
    },
    source: childA,
    target: childA,
  });
  const blockedAncestor = evaluateMpScopeAccess({
    memory: {
      memoryId: "memory-local",
      projectId: "project-a",
      agentId: "child-a",
      scopeLevel: "agent_isolated",
      sessionMode: "isolated",
      visibilityState: "local_only",
    },
    source: childA,
    target: root,
  });
  const projectWide = evaluateMpScopeAccess({
    memory: {
      memoryId: "memory-project",
      projectId: "project-a",
      agentId: "child-a",
      scopeLevel: "project",
      sessionMode: "shared",
      visibilityState: "project_shared",
    },
    source: childA,
    target: childB,
  });

  assert.equal(localDecision.allowed, true);
  assert.equal(blockedAncestor.allowed, false);
  assert.equal(projectWide.allowed, true);
  assert.equal(projectWide.relation, "peer");
});

test("mp scope visibility blocks cross-project project scope but allows global scope", () => {
  const blockedProject = evaluateMpScopeAccess({
    memory: {
      memoryId: "memory-project",
      projectId: "project-a",
      agentId: "child-a",
      scopeLevel: "project",
      sessionMode: "shared",
      visibilityState: "project_shared",
    },
    source: childA,
    target: distantOtherProject,
  });
  const allowedGlobal = evaluateMpScopeAccess({
    memory: {
      memoryId: "memory-global",
      projectId: "project-a",
      agentId: "child-a",
      scopeLevel: "global",
      sessionMode: "shared",
      visibilityState: "global_shared",
    },
    source: childA,
    target: distantOtherProject,
  });

  assert.equal(blockedProject.allowed, false);
  assert.equal(allowedGlobal.allowed, true);
  assert.doesNotThrow(() => assertMpScopeVisibleToTarget({
    memory: {
      memoryId: "memory-global",
      projectId: "project-a",
      agentId: "child-a",
      scopeLevel: "global",
      sessionMode: "shared",
      visibilityState: "global_shared",
    },
    source: childA,
    target: distantOtherProject,
  }));
});

test("mp promotion allows parent-mediated upward promotion but blocks skipping", () => {
  const toProject = evaluateMpPromotionAllowed({
    memory: {
      memoryId: "memory-local",
      scopeLevel: "agent_isolated",
    },
    owner: childA,
    promoter: root,
    nextScopeLevel: "project",
  });

  assert.equal(toProject.allowed, true);
  assert.equal(toProject.relation, "parent");

  assert.doesNotThrow(() => assertMpPromotionAllowed({
    memory: {
      memoryId: "memory-project",
      scopeLevel: "project",
    },
    owner: childA,
    promoter: root,
    nextScopeLevel: "global",
  }));

  assert.throws(() => assertMpPromotionAllowed({
    memory: {
      memoryId: "memory-local",
      scopeLevel: "agent_isolated",
    },
    owner: childA,
    promoter: childB,
    nextScopeLevel: "project",
  }), /cannot be promoted/i);
});
