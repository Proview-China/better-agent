import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoreBoundedOutputLines,
  createCoreBrowserDisciplineLines,
  createCoreCapabilityWindowLines,
  createCoreCmpHandoffLines,
  createCoreContextEconomyLines,
  createCoreContinuationCompactionLines,
  createCoreDevelopmentPromptPack,
  createCoreLoopContinuationLines,
  createCoreObjectiveAnchoringLines,
  createCoreSearchDisciplineLines,
  createCoreWorkspaceInitDisciplineLines,
  createCoreTaskStatusDisciplineLines,
  createCoreValidationLadderLines,
  createCoreWorkflowProtocolLines,
} from "./development.js";

test("createCoreDevelopmentPromptPack returns stable pack id and injects runtime facts", () => {
  const pack = createCoreDevelopmentPromptPack({
    tapMode: "bapr",
    automationDepth: "prefer_auto",
    uiMode: "direct",
  });

  assert.equal(pack.promptPackId, "core-development/v1");
  assert.match(pack.text, /You are currently operating inside the Praxis runtime discipline layer\./);
  assert.match(pack.text, /Runtime facts:/);
  assert.match(pack.text, /- TAP mode: bapr/);
  assert.match(pack.text, /- automation depth: prefer_auto/);
  assert.match(pack.text, /- ui mode: direct/);
});

test("development prompt keeps discipline text but avoids giant capability schema", () => {
  const pack = createCoreDevelopmentPromptPack({
    tapMode: "bapr",
    automationDepth: "prefer_auto",
  });

  assert.match(pack.text, /Capability discipline:/);
  assert.match(pack.text, /Workflow protocol:/);
  assert.match(pack.text, /Context economy:/);
  assert.match(pack.text, /Continuation and resume discipline:/);
  assert.doesNotMatch(pack.text, /shell\.restricted/);
  assert.doesNotMatch(pack.text, /Exact JSON schema/);
});

test("createCoreTaskStatusDisciplineLines renders shared task status rules", () => {
  const lines = createCoreTaskStatusDisciplineLines({
    incompleteActionPhrase: "emit action=capability_call instead of stopping with action=reply",
  });

  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /Always set taskStatus/);
  assert.match(lines[2]!, /emit action=capability_call instead of stopping with action=reply/);
});

test("createCoreLoopContinuationLines emits active-loop reminders only when needed", () => {
  const lines = createCoreLoopContinuationLines({
    toolResultPresent: true,
    capabilityLoopIndex: 1,
    maxCapabilityLoops: 4,
    previousTaskStatus: "incomplete",
    previousReplyText: "还没完",
  });

  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /active agent loop after tool step 1\/4/);
  assert.match(lines[1]!, /previous follow-up reply still marked the task as incomplete/);
});

test("shared capability window lines cover both user-input and planner variants", () => {
  const userInputLines = createCoreCapabilityWindowLines({ mode: "user_input" });
  const plannerLines = createCoreCapabilityWindowLines({ mode: "action_planner" });

  assert.equal(userInputLines.length, 5);
  assert.equal(plannerLines.length, 5);
  assert.match(userInputLines[0]!, /registered TAP capability window/);
  assert.match(plannerLines[0]!, /registered capabilities are already available/);
});

test("browser, search, and bounded output helpers stay out of final-answer mode", () => {
  assert.equal(createCoreBrowserDisciplineLines({ forceFinalAnswer: true }).length, 0);
  assert.equal(createCoreSearchDisciplineLines({ mode: "user_input", forceFinalAnswer: true }).length, 0);
  assert.equal(createCoreBoundedOutputLines({ mode: "action_planner", forceFinalAnswer: true }).length, 0);
  assert.equal(createCoreWorkspaceInitDisciplineLines({ forceFinalAnswer: true }).length, 0);

  assert.equal(createCoreBrowserDisciplineLines({}).length, 2);
  assert.equal(createCoreSearchDisciplineLines({ mode: "action_planner" }).length, 1);
  assert.equal(createCoreBoundedOutputLines({ mode: "user_input" }).length, 1);
  assert.equal(createCoreWorkspaceInitDisciplineLines({}).length, 5);
  assert.match(createCoreWorkspaceInitDisciplineLines({})[2]!, /drifts slightly/i);
  assert.match(createCoreWorkspaceInitDisciplineLines({})[3]!, /rerunning \/init/i);
});

test("objective, workflow, validation, context, and continuation helpers expose thick protocol lines", () => {
  const objectiveLines = createCoreObjectiveAnchoringLines({});
  const workflowLines = createCoreWorkflowProtocolLines({ mode: "user_input" });
  const validationLines = createCoreValidationLadderLines({});
  const contextEconomyLines = createCoreContextEconomyLines({});
  const continuationLines = createCoreContinuationCompactionLines({});

  assert.equal(objectiveLines.length, 3);
  assert.equal(workflowLines.length, 3);
  assert.equal(validationLines.length, 3);
  assert.equal(contextEconomyLines.length, 3);
  assert.equal(continuationLines.length, 3);

  assert.match(objectiveLines[0]!, /concrete object of work/);
  assert.match(workflowLines[0]!, /real progression loop/);
  assert.match(validationLines[0]!, /validation as a ladder/);
  assert.match(contextEconomyLines[1]!, /CMP-supplied executable packages/);
  assert.match(continuationLines[1]!, /compacted/);
});

test("createCoreCmpHandoffLines changes discipline by delivery status", () => {
  const available = createCoreCmpHandoffLines({
    cmpWorksitePackage: {
      schemaVersion: "core-cmp-worksite-package/v1",
      deliveryStatus: "available",
    },
  });
  const partial = createCoreCmpHandoffLines({
    cmpContextPackage: {
      schemaVersion: "core-cmp-context-package/v1",
      deliveryStatus: "partial",
    },
  });
  const pending = createCoreCmpHandoffLines({
    cmpContextPackage: {
      schemaVersion: "core-cmp-context-package/v1",
      deliveryStatus: "pending",
    },
  });

  assert.match(available.join("\n"), /current project worksite/);
  assert.match(partial.join("\n"), /conservatively/);
  assert.match(pending.join("\n"), /currently pending/);
});
