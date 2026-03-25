import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpRulePack,
  createCmpSection,
  createCmpStoredSectionFromSection,
  evaluateCmpRulePack
} from "./cmp-domain.js";

test("cmp domain can create a first-class section and derive a stored section", () => {
  const section = createCmpSection({
    id: "section-1",
    projectId: "proj-cmp",
    agentId: "main",
    lineagePath: ["main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "exact",
    payloadRefs: ["payload://context/1"],
    tags: ["active", "seed"],
    createdAt: "2026-03-24T00:00:00.000Z"
  });

  const stored = createCmpStoredSectionFromSection({
    storedSectionId: "stored-1",
    section,
    plane: "git",
    storageRef: "refs/heads/cmp/main",
    persistedAt: "2026-03-24T00:00:01.000Z"
  });

  assert.equal(section.kind, "runtime_context");
  assert.equal(stored.sourceSectionId, section.id);
  assert.equal(stored.plane, "git");
  assert.equal(stored.visibility, "local");
});

test("cmp domain rule pack evaluates matches by priority and returns a stable recommended action", () => {
  const section = createCmpSection({
    id: "section-2",
    projectId: "proj-cmp",
    agentId: "child-a",
    lineagePath: ["main", "child-a"],
    source: "child_agent",
    kind: "promotion_signal",
    fidelity: "checked",
    payloadRefs: ["payload://promotion/2"],
    tags: ["promotion", "high-signal"],
    createdAt: "2026-03-24T00:05:00.000Z"
  });

  const pack = createCmpRulePack({
    id: "rules-main",
    name: "CMP Main Rules",
    rules: [
      {
        id: "rule-store",
        name: "Store checked sections",
        action: "store",
        priority: 10,
        minFidelity: "checked"
      },
      {
        id: "rule-promote",
        name: "Promote high-signal promotion sections",
        action: "promote",
        priority: 20,
        sectionKinds: ["promotion_signal"],
        requiredTags: ["high-signal"]
      }
    ]
  });

  const evaluation = evaluateCmpRulePack({
    pack,
    section
  });

  assert.equal(evaluation.recommendedAction, "promote");
  assert.equal(evaluation.matches.length, 2);
  assert.equal(evaluation.matches[0]?.ruleId, "rule-promote");
});

test("cmp domain defaults to defer when no rule matches", () => {
  const section = createCmpSection({
    id: "section-3",
    projectId: "proj-cmp",
    agentId: "peer-a",
    lineagePath: ["main", "peer-a"],
    source: "peer_agent",
    kind: "peer_signal",
    fidelity: "projected",
    payloadRefs: ["payload://peer/3"],
    tags: ["peer"],
    createdAt: "2026-03-24T00:10:00.000Z"
  });

  const evaluation = evaluateCmpRulePack({
    pack: {
      id: "rules-empty",
      name: "No Match Rules",
      rules: [
        {
          id: "rule-only-parent",
          name: "Only parent dispatch",
          action: "dispatch",
          priority: 5,
          sources: ["parent_agent"],
          requiredTags: ["dispatchable"]
        }
      ]
    },
    section
  });

  assert.equal(evaluation.recommendedAction, "defer");
  assert.deepEqual(evaluation.matches, []);
  assert.match(evaluation.reasons[0] ?? "", /No rule matched/);
});
