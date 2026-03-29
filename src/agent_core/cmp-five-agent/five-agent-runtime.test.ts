import assert from "node:assert/strict";
import test from "node:test";

import { createCmpBranchFamily } from "../cmp-types/index.js";
import { createCmpFiveAgentRuntime } from "./five-agent-runtime.js";

test("CmpFiveAgentRuntime creates per-role summaries", () => {
  const runtime = createCmpFiveAgentRuntime();
  runtime.icma.capture({
    ingest: {
      agentId: "main",
      sessionId: "session-1",
      taskSummary: "bootstrap five-agent",
      materials: [{ kind: "user_input", ref: "msg:1" }],
      lineage: {
        agentId: "main",
        projectId: "proj-1",
        depth: 0,
        status: "active",
        branchFamily: createCmpBranchFamily({
          workBranch: "work/main",
          cmpBranch: "cmp/main",
          mpBranch: "mp/main",
          tapBranch: "tap/main",
        }),
      },
    },
    createdAt: "2026-03-25T00:00:00.000Z",
    loopId: "icma-loop-1",
  });

  const summary = runtime.createSummary("main");
  assert.equal(summary.roleCounts.icma, 1);
  assert.equal(summary.configurationVersion, "cmp-five-agent-role-catalog/v1");
  assert.equal(summary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/v1");
  assert.deepEqual(summary.capabilityMatrix.gitWriters, ["iterator", "checker"]);
  assert.deepEqual(summary.capabilityMatrix.dbWriters, ["dbagent"]);
  assert.equal(summary.tapProfiles.icma.profileId, "cmp-five-agent/icma-tap-profile/v1");
});
