import test from "node:test";
import assert from "node:assert/strict";

import {
  formatHumanGateDecisionEnvelope,
  parseHumanGateDecisionEnvelope,
} from "./human-gate-envelope.js";

test("human gate decision envelope formatter round-trips through the parser", () => {
  const encoded = formatHumanGateDecisionEnvelope({
    gateId: "gate-42",
    action: "approve_always",
    note: "Allow this prefix for the current agent.",
  });
  assert.deepEqual(parseHumanGateDecisionEnvelope(encoded), {
    type: "human_gate_decision",
    gateId: "gate-42",
    action: "approve_always",
    note: "Allow this prefix for the current agent.",
  });
});

test("human gate decision envelope parser rejects malformed payloads", () => {
  assert.equal(parseHumanGateDecisionEnvelope("not-json"), undefined);
  assert.equal(parseHumanGateDecisionEnvelope("{"), undefined);
  assert.equal(parseHumanGateDecisionEnvelope("{\"type\":\"human_gate_decision\"}"), undefined);
  assert.equal(parseHumanGateDecisionEnvelope("{\"type\":\"human_gate_decision\",\"gateId\":\"\",\"action\":\"approve\"}"), undefined);
  assert.equal(parseHumanGateDecisionEnvelope("{\"type\":\"human_gate_decision\",\"gateId\":\"gate-1\",\"action\":\"noop\"}"), undefined);
});
