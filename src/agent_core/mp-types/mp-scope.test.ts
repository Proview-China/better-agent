import assert from "node:assert/strict";
import test from "node:test";

import {
  MP_PROMOTION_STATES,
  MP_SCOPE_LEVELS,
  MP_SESSION_MODES,
  MP_VISIBILITY_STATES,
  assertMpPromotionTransition,
  createMpScopeDescriptor,
} from "./index.js";

test("mp scope constants expose the frozen baseline enums", () => {
  assert.deepEqual(MP_SCOPE_LEVELS, [
    "global",
    "project",
    "agent_isolated",
  ]);
  assert.deepEqual(MP_SESSION_MODES, [
    "isolated",
    "bridged",
    "shared",
  ]);
  assert.deepEqual(MP_VISIBILITY_STATES, [
    "local_only",
    "session_bridged",
    "project_shared",
    "global_shared",
    "archived",
  ]);
  assert.deepEqual(MP_PROMOTION_STATES, [
    "local_only",
    "submitted_to_parent",
    "accepted_by_parent",
    "promoted_to_project",
    "promoted_to_global",
    "archived",
  ]);
});

test("mp scope descriptor derives stable defaults from scope level", () => {
  const agentScope = createMpScopeDescriptor({
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.root", "agent.main"],
  });
  const projectScope = createMpScopeDescriptor({
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "project",
  });
  const globalScope = createMpScopeDescriptor({
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "global",
  });

  assert.equal(agentScope.scopeLevel, "agent_isolated");
  assert.equal(agentScope.sessionMode, "isolated");
  assert.equal(agentScope.visibilityState, "local_only");
  assert.equal(agentScope.promotionState, "local_only");
  assert.deepEqual(agentScope.lineagePath, ["agent.root", "agent.main"]);

  assert.equal(projectScope.sessionMode, "shared");
  assert.equal(projectScope.visibilityState, "project_shared");
  assert.equal(projectScope.promotionState, "promoted_to_project");

  assert.equal(globalScope.sessionMode, "shared");
  assert.equal(globalScope.visibilityState, "global_shared");
  assert.equal(globalScope.promotionState, "promoted_to_global");
});

test("mp scope validation rejects incompatible scope and session combinations", () => {
  assert.throws(() => createMpScopeDescriptor({
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "project",
    sessionMode: "isolated",
  }), /project scope requires sessionMode=shared/i);

  assert.throws(() => createMpScopeDescriptor({
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "agent_isolated",
    sessionMode: "shared",
  }), /agent_isolated scope does not allow sessionMode=shared/i);
});

test("mp promotion transition rejects skipping and backwards moves", () => {
  assert.doesNotThrow(() => assertMpPromotionTransition({
    from: "local_only",
    to: "submitted_to_parent",
  }));

  assert.throws(() => assertMpPromotionTransition({
    from: "local_only",
    to: "promoted_to_project",
  }), /cannot transition/i);

  assert.throws(() => assertMpPromotionTransition({
    from: "promoted_to_project",
    to: "accepted_by_parent",
  }), /cannot transition/i);
});
