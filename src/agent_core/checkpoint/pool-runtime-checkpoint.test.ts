import assert from "node:assert/strict";
import test from "node:test";

import { createInitialAgentState } from "../state/state-types.js";
import {
  createTaActivationAttemptRecord,
  createTaPendingReplay,
  createTaResumeEnvelope,
  createTapPoolRuntimeSnapshot,
} from "../ta-pool-runtime/index.js";
import {
  createPoolRuntimeCheckpointSnapshot,
  mergePoolRuntimeSnapshotsIntoCheckpointSnapshot,
  readTapActivationAttempts,
  readTapPendingReplays,
  readTapPoolRuntimeSnapshots,
  readTapResumeEnvelopes,
} from "./pool-runtime-checkpoint.js";
import { createAccessRequest, createProvisionArtifactBundle } from "../ta-pool-types/index.js";

function createRunRecord(runId: string, sessionId: string) {
  return {
    runId,
    sessionId,
    status: "deciding" as const,
    phase: "decision" as const,
    goal: {
      goalId: `${runId}:goal`,
      instructionText: "Do thing",
      successCriteria: [],
      failureCriteria: [],
      constraints: [],
      inputRefs: [],
      cacheKey: `${runId}:goal-cache`,
    },
    currentStep: 1,
    pendingIntentId: undefined,
    lastEventId: undefined,
    lastResult: undefined,
    lastCheckpointRef: undefined,
    startedAt: "2026-03-19T16:30:00.000Z",
    endedAt: undefined,
    metadata: undefined,
  };
}

test("pool runtime checkpoint snapshot carries TAP runtime state alongside run and state", () => {
  const snapshot = createPoolRuntimeCheckpointSnapshot({
    run: createRunRecord("run-1", "session-1"),
    state: createInitialAgentState(),
    poolRuntimeSnapshots: {
      tap: createTapPoolRuntimeSnapshot({
        humanGates: [],
        humanGateEvents: [],
        pendingReplays: [],
        activationAttempts: [],
        resumeEnvelopes: [],
      }),
    },
  });

  assert.equal(snapshot.poolRuntimeSnapshots?.tap?.humanGates.length, 0);
  assert.equal(snapshot.run.sessionId, "session-1");
});

test("pool runtime checkpoint helper can merge and read TAP snapshot fragments", () => {
  const base = createPoolRuntimeCheckpointSnapshot({
    run: createRunRecord("run-2", "session-2"),
    state: createInitialAgentState(),
  });
  const merged = mergePoolRuntimeSnapshotsIntoCheckpointSnapshot({
    snapshot: base,
    poolRuntimeSnapshots: {
      tap: createTapPoolRuntimeSnapshot({
        humanGates: [],
        humanGateEvents: [],
        pendingReplays: [],
        activationAttempts: [],
        resumeEnvelopes: [],
      }),
    },
  });

  const tap = readTapPoolRuntimeSnapshots({
    poolRuntimeSnapshots: merged.poolRuntimeSnapshots,
  });

  assert.equal(tap?.pendingReplays.length, 0);
});

test("pool runtime checkpoint helper exposes replay, activation, and resume handoff slices", () => {
  const request = createAccessRequest({
    requestId: "req-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "shell.exec",
    requestedTier: "B1",
    reason: "Run a bounded shell command.",
    mode: "balanced",
    createdAt: "2026-03-21T00:00:00.000Z",
  });
  const provisionBundle = createProvisionArtifactBundle({
    bundleId: "bundle-1",
    provisionId: "provision-1",
    status: "ready",
    toolArtifact: { artifactId: "tool-1", kind: "tool", ref: "tool:1" },
    bindingArtifact: { artifactId: "binding-1", kind: "binding", ref: "binding:1" },
    verificationArtifact: { artifactId: "verification-1", kind: "verification", ref: "verification:1" },
    usageArtifact: { artifactId: "usage-1", kind: "usage", ref: "usage:1" },
    replayPolicy: "manual",
    completedAt: "2026-03-21T00:00:00.000Z",
  });

  const recovery = {
    poolRuntimeSnapshots: {
      tap: createTapPoolRuntimeSnapshot({
        humanGates: [],
        humanGateEvents: [],
        pendingReplays: [
          createTaPendingReplay({
            replayId: "replay-1",
            request,
            provisionBundle,
            createdAt: "2026-03-21T00:00:00.000Z",
          }),
        ],
        activationAttempts: [
          createTaActivationAttemptRecord({
            attemptId: "attempt-1",
            provisionId: "provision-1",
            capabilityKey: "shell.exec",
            targetPool: "ta-capability-pool",
            activationMode: "stage_only",
            registrationStrategy: "register_or_replace",
            startedAt: "2026-03-21T00:00:01.000Z",
          }),
        ],
        resumeEnvelopes: [
          createTaResumeEnvelope({
            envelopeId: "resume-1",
            source: "replay",
            requestId: "req-1",
            sessionId: "session-1",
            runId: "run-1",
            capabilityKey: "shell.exec",
            requestedTier: "B1",
            mode: "balanced",
            reason: "Resume after manual approval.",
          }),
        ],
      }),
    },
  };

  assert.equal(readTapPendingReplays(recovery)?.[0]?.replayId, "replay-1");
  assert.equal(readTapActivationAttempts(recovery)?.[0]?.attemptId, "attempt-1");
  assert.equal(readTapResumeEnvelopes(recovery)?.[0]?.envelopeId, "resume-1");
});
