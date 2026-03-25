import assert from "node:assert/strict";
import test from "node:test";

import type { PreparedInvocation } from "../../rax/contracts.js";
import type {
  SkillActivationPlan,
  SkillContainer,
  SkillMountResult,
  SkillUseResult,
} from "../../rax/index.js";
import { createRaxSkillCapabilityAdapter } from "./rax-skill-adapter.js";

function createContainer(): SkillContainer {
  return {
    descriptor: {
      id: "skill_browser",
      name: "Browser Skill",
      description: "Drive a browser workflow.",
      version: "v1",
      tags: ["browser"],
      triggers: ["open page"],
      source: {
        kind: "local",
        rootDir: "/skills/browser",
        entryPath: "/skills/browser/SKILL.md",
      },
    },
    source: {
      kind: "local",
      rootDir: "/skills/browser",
      entryPath: "/skills/browser/SKILL.md",
    },
    entry: {
      path: "/skills/browser/SKILL.md",
      content: "# Browser Skill",
    },
    resources: [],
    helpers: [],
    bindings: {},
    policy: {
      invocationMode: "auto",
      requiresApproval: false,
      riskLevel: "low",
      sourceTrust: "local",
    },
    loading: {
      metadata: "always",
      entry: "on-activate",
      resources: "on-demand",
      helpers: "on-demand",
    },
    ledger: {
      discoverCount: 0,
      activationCount: 0,
    },
  };
}

function createActivation(provider: SkillActivationPlan["provider"]): SkillActivationPlan {
  return {
    provider,
    mode: provider === "anthropic" ? "anthropic-sdk-filesystem" : provider === "deepmind" ? "google-adk-local" : "openai-local-shell",
    layer: "agent",
    officialCarrier:
      provider === "anthropic"
        ? "anthropic-sdk-filesystem-skill"
        : provider === "deepmind"
          ? "google-adk-skill-toolset"
          : "openai-shell-environment",
    composeStrategy:
      provider === "anthropic" || provider === "deepmind"
        ? "runtime-only"
        : "payload-merge",
    composeNotes:
      provider === "anthropic"
        ? "Anthropic filesystem skills currently require the SDK runtime path instead of payload-merge composition."
        : provider === "deepmind"
          ? "Google ADK skill carriers currently require an ADK runtime path instead of payload-merge composition."
          : "OpenAI shell skill carriers can currently be merged into Responses generation requests.",
    payload: {},
    entry: {
      path: "/skills/browser/SKILL.md",
      content: "# Browser Skill",
    },
    resources: [],
    helpers: [],
  } as SkillActivationPlan;
}

function createInvocation(provider: "openai" | "anthropic" | "deepmind"): PreparedInvocation<Record<string, unknown>> {
  return {
    key: "skill.use",
    provider,
    model: "gpt-5.4",
    layer: "agent",
    adapterId: "skill.adapter",
    sdk: {
      packageName: "@test/skill",
      entrypoint: "skill.use",
    },
    payload: {},
  };
}

test("rax skill adapter supports skill.use plan with normalized route context", () => {
  const adapter = createRaxSkillCapabilityAdapter({
    skill: {} as never,
  });

  const plan = {
    planId: "plan_001",
    intentId: "intent_001",
    sessionId: "session_001",
    runId: "run_001",
    capabilityKey: "skill.use",
    operation: "skill.use",
    input: {
      route: {
        provider: "openai",
        model: "gpt-5.4",
        layer: "agent",
      },
      source: "/skills/browser",
    },
    priority: "high" as const,
  };

  assert.equal(adapter.supports(plan), true);
});

test("rax skill adapter supports skill.use plans that attach a remote skill reference", () => {
  const adapter = createRaxSkillCapabilityAdapter({
    skill: {} as never,
  });

  const plan = {
    planId: "plan_ref_001",
    intentId: "intent_ref_001",
    sessionId: "session_ref_001",
    runId: "run_ref_001",
    capabilityKey: "skill.use",
    operation: "skill.use",
    input: {
      route: {
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        layer: "api",
      },
      reference: {
        id: "pptx",
        version: "latest",
      },
      mode: "anthropic-api-managed",
      details: {
        type: "anthropic",
      },
    },
    priority: "high" as const,
  };

  assert.equal(adapter.supports(plan), true);
});

test("rax skill adapter prepare builds a direct prepared call for skill.use", async () => {
  const adapter = createRaxSkillCapabilityAdapter({
    skill: {} as never,
  });

  const plan = {
    planId: "plan_001",
    intentId: "intent_001",
    sessionId: "session_001",
    runId: "run_001",
    capabilityKey: "skill.use",
    operation: "skill.use",
    input: {
      provider: "openai",
      model: "gpt-5.4",
      layer: "agent",
      source: "/skills/browser",
    },
    priority: "normal" as const,
    idempotencyKey: "skill:browser:use",
  };

  const lease = {
    leaseId: "lease_001",
    capabilityId: "skill.use",
    bindingId: "binding_001",
    generation: 1,
    grantedAt: "2026-03-18T00:00:00.000Z",
    priority: "normal" as const,
    preparedCacheKey: "prepared:skill:browser:use",
  };

  const prepared = await adapter.prepare(plan, lease);
  assert.equal(prepared.bindingId, "binding_001");
  assert.equal(prepared.executionMode, "direct");
  assert.equal(prepared.cacheKey, "prepared:skill:browser:use");
});

test("rax skill adapter execute maps skill.use and returns sanitized output", async () => {
  const container = createContainer();
  const facade = {
    skill: {
      async use(): Promise<SkillUseResult> {
        return {
          container,
          activation: createActivation("openai"),
          invocation: createInvocation("openai"),
        };
      },
      mount(): SkillMountResult {
        throw new Error("mount should not be called in this test");
      },
      prepare(): PreparedInvocation<Record<string, unknown>> {
        throw new Error("prepare should not be called in this test");
      },
    },
  };

  const adapter = createRaxSkillCapabilityAdapter(facade);
  const plan = {
    planId: "plan_001",
    intentId: "intent_001",
    sessionId: "session_001",
    runId: "run_001",
    capabilityKey: "skill.use",
    operation: "skill.use",
    input: {
      provider: "openai",
      model: "gpt-5.4",
      layer: "agent",
      source: "/skills/browser",
      includeResources: true,
    },
    priority: "normal" as const,
  };
  const lease = {
    leaseId: "lease_001",
    capabilityId: "skill.use",
    bindingId: "binding_001",
    generation: 1,
    grantedAt: "2026-03-18T00:00:00.000Z",
    priority: "normal" as const,
  };
  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  const output = envelope.output as {
    action: string;
    activation: {
      officialCarrier: string;
      composeStrategy: string;
      composeNotes?: string;
    };
    preparedInvocation: { adapterId?: string; key: string };
  };
  assert.equal(output.action, "skill.use");
  assert.equal(output.activation.officialCarrier, "openai-shell-environment");
  assert.equal(output.activation.composeStrategy, "payload-merge");
  assert.match(output.activation.composeNotes ?? "", /Responses generation requests/u);
  assert.equal(output.preparedInvocation.key, "skill.use");
  assert.equal("adapterId" in output.preparedInvocation, false);
});

test("rax skill adapter execute accepts reference-first skill.use input", async () => {
  const container = createContainer();
  const facade = {
    skill: {
      async use(): Promise<SkillUseResult> {
        return {
          container: {
            ...container,
            source: {
              kind: "virtual",
              rootDir: "virtual://skill/pptx",
              entryPath: "virtual://skill/pptx/SKILL.md",
            },
            descriptor: {
              ...container.descriptor,
              id: "pptx",
              name: "PowerPoint Skill",
            },
          },
          activation: createActivation("anthropic"),
          invocation: createInvocation("anthropic"),
        };
      },
      mount(): SkillMountResult {
        throw new Error("mount should not be called in this test");
      },
      prepare(): PreparedInvocation<Record<string, unknown>> {
        throw new Error("prepare should not be called in this test");
      },
    },
  };

  const adapter = createRaxSkillCapabilityAdapter(facade);
  const plan = {
    planId: "plan_ref_001",
    intentId: "intent_ref_001",
    sessionId: "session_ref_001",
    runId: "run_ref_001",
    capabilityKey: "skill.use",
    operation: "skill.use",
    input: {
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      reference: {
        id: "pptx",
        version: "latest",
      },
      mode: "anthropic-api-managed",
      details: {
        type: "anthropic",
      },
    },
    priority: "normal" as const,
  };
  const lease = {
    leaseId: "lease_ref_001",
    capabilityId: "skill.use",
    bindingId: "binding_ref_001",
    generation: 1,
    grantedAt: "2026-03-18T00:00:00.000Z",
    priority: "normal" as const,
  };

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  const output = envelope.output as {
    activation: {
      composeStrategy: string;
      composeNotes?: string;
    };
    container: {
      source: {
        kind: string;
      };
    };
  };
  assert.equal(output.container.source.kind, "virtual");
  assert.equal(output.activation.composeStrategy, "runtime-only");
  assert.match(output.activation.composeNotes ?? "", /SDK runtime path/u);
});
