import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSafetyInterception,
  isDangerousCapabilityKey,
  shouldInterruptYoloRequest,
} from "./safety-interceptor.js";

test("safety interceptor blocks clearly dangerous capability keys", () => {
  const result = evaluateSafetyInterception({
    mode: "permissive",
    requestedTier: "B2",
    capabilityKey: "shell.rm.force",
    reason: "Delete a folder recursively.",
  });

  assert.equal(result.outcome, "escalate_to_human");
  assert.equal(result.matchedPattern, "shell.rm*");
});

test("safety interceptor keeps restricted normal baseline candidates alive for gateway routing", () => {
  const result = evaluateSafetyInterception({
    mode: "restricted",
    requestedTier: "B0",
    capabilityKey: "docs.read",
    reason: "Read a workspace document.",
  });

  assert.equal(result.outcome, "allow");
  assert.equal(result.riskLevel, "normal");
});

test("safety interceptor can downgrade broad but non-critical shell requests", () => {
  const result = evaluateSafetyInterception({
    mode: "permissive",
    requestedTier: "B2",
    capabilityKey: "shell.exec",
    reason: "Need shell access.",
  });

  assert.equal(result.outcome, "downgrade");
  assert.equal(result.downgradedTier, "B1");
});

test("safety interceptor escalates risky restricted requests to human", () => {
  const result = evaluateSafetyInterception({
    mode: "restricted",
    requestedTier: "B2",
    capabilityKey: "mcp.playwright",
    reason: "Need browser control.",
  });

  assert.equal(result.outcome, "escalate_to_human");
  assert.equal(result.riskLevel, "risky");
});

test("safety interceptor interrupts only dangerous yolo requests", () => {
  const result = evaluateSafetyInterception({
    mode: "yolo",
    requestedTier: "B2",
    capabilityKey: "shell.exec",
    reason: "Run a shell command.",
  });

  assert.equal(result.outcome, "allow");
  assert.equal(result.riskLevel, "risky");
});

test("safety interceptor still interrupts dangerous yolo requests", () => {
  const result = evaluateSafetyInterception({
    mode: "yolo",
    requestedTier: "B2",
    capabilityKey: "shell.rm.force",
    reason: "Delete a folder recursively.",
  });

  assert.equal(result.outcome, "interrupt");
  assert.equal(result.riskLevel, "dangerous");
});

test("safety interceptor fully bypasses bapr mode", () => {
  const result = evaluateSafetyInterception({
    mode: "bapr",
    requestedTier: "B3",
    capabilityKey: "shell.rm.force",
    reason: "Delete a folder recursively.",
  });

  assert.equal(result.outcome, "allow");
  assert.equal(result.riskLevel, "dangerous");
});

test("dangerous capability helper returns the first matched pattern", () => {
  const result = isDangerousCapabilityKey({
    capabilityKey: "workspace.outside.write",
  });

  assert.equal(result.dangerous, true);
  assert.equal(result.matchedPattern, "workspace.outside.write");
});

test("yolo interrupt helper only flags dangerous requests", () => {
  const risky = shouldInterruptYoloRequest({
    requestedTier: "B1",
    capabilityKey: "mcp.playwright",
  });
  const dangerous = shouldInterruptYoloRequest({
    requestedTier: "B1",
    capabilityKey: "shell.rm.force",
  });

  assert.equal(risky.interrupt, false);
  assert.equal(dangerous.interrupt, true);
  assert.equal(dangerous.matchedPattern, "shell.rm*");
});
