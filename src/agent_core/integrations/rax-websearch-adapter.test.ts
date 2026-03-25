import assert from "node:assert/strict";
import test from "node:test";

import {
  RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
  createRaxWebsearchCapabilityPackage,
} from "../capability-package/index.js";
import { createCapabilityLease } from "../capability-invocation/capability-lease.js";
import { createCapabilityInvocationPlan } from "../capability-invocation/capability-plan.js";
import {
  createRaxWebsearchActivationFactory,
  createRaxWebsearchAdapter,
  type RaxWebsearchAdapterOptions,
} from "./rax-websearch-adapter.js";
import {
  createActivationFactoryResolver,
  materializeActivationRegistration,
} from "../ta-pool-runtime/index.js";

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
  assert.ok(prepared.preparedPayloadRef?.startsWith("rax-websearch:"));

  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal(
    (envelope.output as { answer: string }).answer,
    "Praxis is a rebooted runtime.",
  );
  assert.equal(envelope.metadata?.provider, "openai");
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
  assert.equal(envelope.error?.code, "rax_websearch_prepared_input_missing");
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
  assert.equal(envelope.error?.code, "rax_search_ground_failed");
  assert.equal(envelope.metadata?.provider, "anthropic");
});

test("rax websearch activation factory materializes a package-backed adapter", async () => {
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
            answer: "package-backed-search-ok",
            citations: [],
            sources: [],
          },
        };
      },
    },
  } as RaxWebsearchAdapterOptions["facade"];

  const capabilityPackage = createRaxWebsearchCapabilityPackage();
  const resolver = createActivationFactoryResolver();
  resolver.register(
    RAX_WEBSEARCH_ACTIVATION_FACTORY_REF,
    createRaxWebsearchActivationFactory({ facade }),
  );

  const materialized = await materializeActivationRegistration({
    capabilityPackage,
    factoryResolver: resolver,
    capabilityIdPrefix: "capability",
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_pkg_001",
      sessionId: "session_pkg_001",
      runId: "run_pkg_001",
      capabilityKey: "search.ground",
      input: {
        provider: "openai",
        model: "gpt-5.4",
        query: "package-backed grounded search",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_pkg_001",
    },
  );

  const lease = createCapabilityLease(
    {
      capabilityId: materialized.manifest.capabilityId,
      bindingId: "binding_pkg_001",
      generation: materialized.manifest.generation,
      plan,
    },
    {
      idFactory: () => "lease_pkg_001",
      clock: {
        now: () => new Date("2026-03-25T00:00:00.000Z"),
      },
    },
  );

  const prepared = await materialized.adapter.prepare(plan, lease);
  const envelope = await materialized.adapter.execute(prepared);

  assert.equal(materialized.manifest.capabilityKey, "search.ground");
  assert.equal(materialized.targetPool, "ta-capability-pool");
  assert.equal(materialized.adapter.id, "adapter:search.ground");
  assert.equal(envelope.status, "success");
  assert.equal(
    (envelope.output as { answer: string }).answer,
    "package-backed-search-ok",
  );
});
