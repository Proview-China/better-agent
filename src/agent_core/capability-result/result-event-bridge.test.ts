import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityResultEnvelope } from "./result-envelope.js";
import { createCapabilityResultReceivedEvent, toKernelResult } from "./result-event-bridge.js";

test("capability result bridge maps envelopes into kernel result and event shapes", () => {
  const envelope = createCapabilityResultEnvelope({
    executionId: "execution_1",
    status: "success",
    output: { answer: "42" },
    completedAt: "2026-03-18T00:00:00.000Z",
  });

  const result = toKernelResult({
    result: envelope,
    sessionId: "session_1",
    runId: "run_1",
  });
  const event = createCapabilityResultReceivedEvent({
    result: envelope,
    sessionId: "session_1",
    runId: "run_1",
    requestId: "request_1",
  });

  assert.equal(result.status, "success");
  assert.equal(event.type, "capability.result_received");
  assert.equal(event.payload.resultId, envelope.resultId);
});

