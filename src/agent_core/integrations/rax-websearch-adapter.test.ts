import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityLease } from "../capability-invocation/capability-lease.js";
import { createCapabilityInvocationPlan } from "../capability-invocation/capability-plan.js";
import { createRaxWebsearchAdapter, type RaxWebsearchAdapterOptions } from "./rax-websearch-adapter.js";

test("rax websearch adapter supports search.ground and prepares direct calls", async () => {
  const facade = {
    websearch: {
      async create() {
        return {
          status: "success",
          provider: "openai",
          model: "gpt-5.4",
          layer: "api",
          capability: "search",
          action: "ground",
          output: {
            capabilityKey: "search.ground",
            answer: "Praxis is a rebooted runtime.",
            citations: [],
            sources: [],
          },
          evidence: [{ source: "test" }],
        };
      },
    },
  } as RaxWebsearchAdapterOptions["facade"];

  const adapter = createRaxWebsearchAdapter({
    facade,
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_001",
      sessionId: "session_001",
      runId: "run_001",
      capabilityKey: "search.ground",
      input: {
        provider: "openai",
        model: "gpt-5.4",
        query: "What is Praxis?",
      },
      priority: "high",
    },
    {
      idFactory: () => "plan_001",
    },
  );

  const lease = createCapabilityLease(
    {
      capabilityId: "cap_search_ground",
      bindingId: "binding_001",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease_001",
      clock: {
        now: () => new Date("2026-03-18T00:00:00.000Z"),
      },
    },
  );

  assert.equal(adapter.supports(plan), true);

  const prepared = await adapter.prepare(plan, lease);
  assert.equal(prepared.bindingId, "binding_001");
  assert.equal(prepared.executionMode, "direct");
  assert.ok(prepared.preparedPayloadRef?.startsWith("rax-search:"));

  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal(
    (envelope.output as { answer: string }).answer,
    "Praxis is a rebooted runtime.",
  );
  assert.equal((envelope.output as { capabilityKey: string }).capabilityKey, "search.ground");
  assert.equal(envelope.metadata?.provider, "openai");
  assert.equal(envelope.metadata?.capabilityKey, "search.ground");
});

test("rax websearch adapter returns failed envelope when prepared input is missing", async () => {
  const adapter = createRaxWebsearchAdapter();
  const envelope = await adapter.execute({
    preparedId: "prepared_missing",
    leaseId: "lease_001",
    capabilityKey: "search.ground",
    bindingId: "binding_001",
    generation: 1,
    executionMode: "direct",
  });

  assert.equal(envelope.status, "failed");
  assert.equal(envelope.error?.code, "rax_search_prepared_input_missing");
});

test("rax websearch adapter maps blocked status into unified envelope", async () => {
  const facade = {
    websearch: {
      async create() {
        return {
          status: "blocked",
          provider: "anthropic",
          model: "claude-opus-4-6-thinking",
          layer: "agent",
          capability: "search",
          action: "ground",
          error: {
            reason: "profile-blocked",
          },
        };
      },
    },
  } as RaxWebsearchAdapterOptions["facade"];

  const adapter = createRaxWebsearchAdapter({
    facade,
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_002",
      sessionId: "session_002",
      runId: "run_002",
      capabilityKey: "search.ground",
      input: {
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        query: "blocked test",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_002",
    },
  );
  const lease = createCapabilityLease(
    {
      capabilityId: "cap_search_ground",
      bindingId: "binding_002",
      generation: 2,
      plan,
    },
    {
      idFactory: () => "lease_002",
      clock: {
        now: () => new Date("2026-03-18T00:00:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "blocked");
  assert.equal(envelope.error?.code, "rax_search_failed");
  assert.equal(envelope.metadata?.provider, "anthropic");
  assert.equal(envelope.metadata?.capabilityKey, "search.ground");
});

test("rax websearch adapter preserves search.web as the final public capability key", async () => {
  const facade = {
    websearch: {
      async create() {
        return {
          status: "success",
          provider: "openai",
          model: "gpt-5.4",
          layer: "api",
          capability: "search",
          action: "ground",
          output: {
            capabilityKey: "search.ground",
            answer: "OpenAI docs are on platform.openai.com/docs.",
            citations: [],
            sources: [],
          },
          evidence: [{ capabilityKey: "search.ground", source: "compat" }],
        };
      },
    },
  } as RaxWebsearchAdapterOptions["facade"];

  const adapter = createRaxWebsearchAdapter({
    facade,
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_003",
      sessionId: "session_003",
      runId: "run_003",
      capabilityKey: "search.web",
      input: {
        provider: "openai",
        model: "gpt-5.4",
        query: "OpenAI docs",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_003",
    },
  );

  const lease = createCapabilityLease(
    {
      capabilityId: "cap_search_web",
      bindingId: "binding_003",
      generation: 3,
      plan,
    },
    {
      idFactory: () => "lease_003",
      clock: {
        now: () => new Date("2026-03-18T00:00:00.000Z"),
      },
    },
  );

  assert.equal(adapter.supports(plan), true);

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { capabilityKey: string }).capabilityKey, "search.web");
  assert.equal(
    (envelope.evidence as Array<{ capabilityKey: string }>)[0]?.capabilityKey,
    "search.web",
  );
  assert.equal(envelope.metadata?.capabilityKey, "search.web");
  assert.equal(envelope.metadata?.action, "web");
});
