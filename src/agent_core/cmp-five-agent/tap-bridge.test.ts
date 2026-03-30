import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpFiveAgentTapBridgeCompiled,
  createCmpFiveAgentTapBridgeMetadata,
} from "./tap-bridge.js";
import type { CmpFiveAgentRuntimeSnapshot } from "./types.js";

function createSnapshot(): CmpFiveAgentRuntimeSnapshot {
  return {
    icmaRecords: [{
      loopId: "icma-1",
      role: "icma",
      agentId: "agent-a",
      stage: "emit",
      createdAt: "2026-03-30T00:00:00.000Z",
      updatedAt: "2026-03-30T00:00:01.000Z",
      chunkIds: ["chunk-1"],
      fragmentIds: ["fragment-1"],
      structuredOutput: {
        intent: "整理上下文",
        sourceAnchorRefs: ["msg:1"],
        candidateBodyRefs: ["msg:1"],
        boundary: "preserve_root_system_and_emit_controlled_fragments_only",
        explicitFragmentIds: ["fragment-1"],
        preSectionIds: ["section-pre-1"],
        guide: {
          operatorGuide: "keep high signal",
          childGuide: "child enters child icma only",
        },
      },
    }],
    iteratorRecords: [],
    checkerRecords: [],
    dbAgentRecords: [],
    dispatcherRecords: [],
    checkpoints: [],
    overrides: [],
    intentChunks: [],
    fragments: [],
    packageFamilies: [],
    taskSnapshots: [],
    promoteRequests: [],
    parentPromoteReviews: [],
    peerApprovals: [],
    reinterventionRequests: [],
  };
}

test("createCmpFiveAgentTapBridgeMetadata packs latest role context for TAP bridge", () => {
  const metadata = createCmpFiveAgentTapBridgeMetadata({
    role: "icma",
    agentId: "agent-a",
    capabilityKey: "cmp.mq.publish.input",
    reason: "publish ingress hint",
    snapshot: createSnapshot(),
    metadata: {
      custom: true,
    },
  });

  assert.equal(metadata.cmpRole, "icma");
  assert.equal(metadata.cmpCapabilityKey, "cmp.mq.publish.input");
  assert.equal((metadata.cmpFiveAgentContext as { stage?: string }).stage, "emit");
  assert.equal(((metadata.cmpFiveAgentContext as { structuredOutput?: { intent?: string } }).structuredOutput)?.intent, "整理上下文");
  assert.equal(metadata.custom, true);
});

test("createCmpFiveAgentTapBridgeCompiled builds a capability intent and dispatch options", () => {
  const compiled = createCmpFiveAgentTapBridgeCompiled({
    role: "icma",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-a",
    capabilityKey: "cmp.mq.publish.input",
    reason: "publish ingress hint",
    capabilityInput: {
      payloadRef: "msg:1",
    },
    snapshot: createSnapshot(),
    cmpContext: {
      requestId: "request-1",
      sourceSnapshotId: "snapshot-1",
    },
  });

  assert.equal(compiled.profile.profileId, "cmp-five-agent/icma-tap-profile/v1");
  assert.equal(compiled.intent.request.capabilityKey, "cmp.mq.publish.input");
  assert.equal((compiled.intent.metadata?.cmpTapBridge as { requestId?: string } | undefined)?.requestId, "request-1");
  assert.equal(compiled.dispatchOptions.agentId, "agent-a");
  assert.equal((compiled.dispatchOptions.metadata?.cmpFiveAgentContext as { stage?: string } | undefined)?.stage, "emit");
});
