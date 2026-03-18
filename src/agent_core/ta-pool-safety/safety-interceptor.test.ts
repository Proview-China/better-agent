import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSafetyInterception,
  isDangerousCapabilityKey,
  shouldInterruptYoloRequest,
} from "./safety-interceptor.js";

test("safety interceptor blocks clearly dangerous capability keys", () => {
  const result = evaluateSafetyInterception({
    mode: "balanced",
    requestedTier: "B2",
    capabilityKey: "shell.rm.force",
    reason: "Delete a folder recursively.",
  });

  assert.equal(result.outcome, "block");
  assert.equal(result.matchedPattern, "shell.rm*");
});

test("safety interceptor can downgrade broad but non-critical shell requests", () => {
  const result = evaluateSafetyInterception({
    mode: "balanced",
    requestedTier: "B2",
    capabilityKey: "shell.exec",
    reason: "Need shell access.",
  });

  assert.equal(result.outcome, "downgrade");
  assert.equal(result.downgradedTier, "B1");
});

test("safety interceptor escalates B3 requests to human outside yolo", () => {
  const result = evaluateSafetyInterception({
    mode: "strict",
    requestedTier: "B3",
    capabilityKey: "mcp.playwright",
    reason: "Need full browser control.",
  });

  assert.equal(result.outcome, "escalate_to_human");
});

test("safety interceptor interrupts risky yolo requests", () => {
  const result = evaluateSafetyInterception({
    mode: "yolo",
    requestedTier: "B3",
    capabilityKey: "shell.exec",
    reason: "Run a dangerous command.",
  });

  assert.equal(result.outcome, "interrupt");
});

test("dangerous capability helper returns the first matched pattern", () => {
  const result = isDangerousCapabilityKey({
    capabilityKey: "workspace.outside.write",
  });

  assert.equal(result.dangerous, true);
  assert.equal(result.matchedPattern, "workspace.outside.write");
});

test("yolo interrupt helper flags B3 and explicit risky patterns", () => {
  const tierOnly = shouldInterruptYoloRequest({
    requestedTier: "B3",
    capabilityKey: "docs.read",
  });
  const pattern = shouldInterruptYoloRequest({
    requestedTier: "B1",
    capabilityKey: "mcp.playwright",
  });

  assert.equal(tierOnly.interrupt, true);
  assert.equal(pattern.interrupt, true);
  assert.equal(pattern.matchedPattern, "mcp.playwright");
});
