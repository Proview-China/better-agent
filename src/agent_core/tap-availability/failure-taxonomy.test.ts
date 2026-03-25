import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTapFailure,
  getTapFailureTaxonomyEntry,
  listTapFailureTaxonomy,
  resolveTapFailureDecision,
} from "./failure-taxonomy.js";

test("listTapFailureTaxonomy exposes the frozen production-like failure catalog", () => {
  const taxonomy = listTapFailureTaxonomy();

  assert.equal(taxonomy.length >= 10, true);
  assert.equal(
    taxonomy.some((entry) => entry.code === "missing_registration" && entry.defaultDecision === "block"),
    true,
  );
  assert.equal(
    taxonomy.some((entry) => entry.code === "runtime_timeout" && entry.defaultDecision === "retry"),
    true,
  );
  assert.equal(
    taxonomy.some((entry) => entry.code === "destructive_capability_request" && entry.defaultDecision === "human_gate"),
    true,
  );
});

test("classifyTapFailure maps canonical failure classes onto expected decisions", () => {
  const missingRegistration = classifyTapFailure({
    code: "missing_registration",
    gateStatus: "blocked",
  });
  assert.equal(missingRegistration.decision, "block");
  assert.equal(missingRegistration.entry.failureClass, "registration_gap");

  const healthGap = classifyTapFailure({
    code: "missing_runtime_health_observation",
    gateStatus: "review_required",
  });
  assert.equal(healthGap.decision, "degrade");
  assert.equal(healthGap.entry.failureClass, "health_gap");

  const timeout = classifyTapFailure({
    code: "runtime_timeout",
    retryable: true,
  });
  assert.equal(timeout.decision, "retry");
  assert.equal(timeout.entry.failureClass, "transient_runtime");

  const dangerous = classifyTapFailure({
    code: "destructive_capability_request",
  });
  assert.equal(dangerous.decision, "human_gate");
  assert.equal(dangerous.entry.failureClass, "governance_risk");
});

test("resolveTapFailureDecision prioritizes human_gate over block, retry, and degrade", () => {
  const decision = resolveTapFailureDecision([
    { code: "missing_runtime_health_observation", gateStatus: "review_required" },
    { code: "runtime_timeout", retryable: true },
    { code: "destructive_capability_request" },
  ]);

  assert.equal(decision, "human_gate");
});

test("unknown failure codes fall back to a blocking taxonomy entry", () => {
  const fallback = getTapFailureTaxonomyEntry("future_unknown_gap");

  assert.equal(fallback.defaultDecision, "block");
  assert.equal(fallback.failureClass, "execution_gap");
  assert.equal(fallback.notes.some((entry) => entry.includes("Unknown failure code")), true);
});
