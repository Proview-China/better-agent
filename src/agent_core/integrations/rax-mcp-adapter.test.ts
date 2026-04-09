import assert from "node:assert/strict";
import test from "node:test";

import type { RaxFacade } from "../../rax/facade.js";
import type { CapabilityInvocationPlan, CapabilityLease } from "../capability-types/index.js";
import {
  createMcpCapabilityPackage,
  createMcpReadCapabilityPackage,
} from "../capability-package/index.js";
import {
  createActivationFactoryResolver,
  materializeActivationRegistration,
} from "../ta-pool-runtime/index.js";
import {
  MCP_READ_FAMILY_ACTIONS,
  RAX_MCP_CAPABILITY_KEYS,
  createRaxMcpActivationFactory,
  createRaxMcpCapabilityAdapter,
  isMcpReadFamilyAction,
  createRaxMcpCapabilityManifest,
  registerRaxMcpCapabilities,
} from "./rax-mcp-adapter.js";

function createLease(): CapabilityLease {
  return {
    leaseId: "lease-1",
    capabilityId: "cap-mcp-call",
    bindingId: "binding-1",
    generation: 1,
    grantedAt: "2026-03-18T00:00:00.000Z",
    priority: "normal",
  };
}

function createPlan(capabilityKey: CapabilityInvocationPlan["capabilityKey"], input: Record<string, unknown>): CapabilityInvocationPlan {
  return {
    planId: `plan-${capabilityKey}`,
    intentId: `intent-${capabilityKey}`,
    sessionId: "session-1",
    runId: "run-1",
    capabilityKey,
    operation: capabilityKey,
    input,
    priority: "normal",
  };
}

function createInputForCapability(
  capabilityKey: CapabilityInvocationPlan["capabilityKey"],
): Record<string, unknown> {
  switch (capabilityKey) {
    case "mcp.listTools":
      return {
        route: { provider: "openai", model: "gpt-5.4" },
        input: { connectionId: "conn-list" },
      };
    case "mcp.listResources":
      return {
        route: { provider: "openai", model: "gpt-5.4" },
        input: { connectionId: "conn-resources" },
      };
    case "mcp.readResource":
      return {
        route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
        input: { connectionId: "conn-read", uri: "memory://resource" },
      };
    case "mcp.call":
      return {
        route: { provider: "openai", model: "gpt-5.4" },
        input: {
          connectionId: "conn-call",
          toolName: "browser.search",
          arguments: { q: "Praxis" },
        },
      };
    case "mcp.native.execute":
      return {
        route: { provider: "deepmind", model: "gemini-2.5-flash", layer: "agent" },
        input: {
          transport: {
            kind: "stdio",
            command: "node",
            args: ["server.js"],
          },
        },
      };
    default:
      throw new Error(`Unexpected MCP capability key in test helper: ${capabilityKey}.`);
  }
}

function createFacadeDouble(): Pick<RaxFacade, "mcp"> {
  return {
    mcp: {
      shared: {} as RaxFacade["mcp"]["shared"],
      native: {
        prepare: () => {
          throw new Error("not used");
        },
        serve: () => {
          throw new Error("not used");
        },
        build: (options) => ({
          key: "mcp.connect",
          provider: options.provider,
          model: options.model,
          layer: options.layer && options.layer !== "auto" ? options.layer : "agent",
          adapterId: "native-build-adapter",
          sdk: {
            packageName: "@test/mcp",
            entrypoint: "native.build",
          },
          payload: {
            input: options.input,
          },
        }),
        compose: () => {
          throw new Error("not used");
        },
        execute: async (invocation) => ({
          ok: true,
          payload: invocation.payload,
        }),
        composeAndExecute: async () => {
          throw new Error("not used");
        },
      },
      use: async () => {
        throw new Error("not used");
      },
      connect: async () => {
        throw new Error("not used");
      },
      listConnections: () => [],
      disconnect: async () => {},
      disconnectAll: async () => {},
      listTools: async (options) => ({
        connectionId: options.input.connectionId,
        tools: [{ name: "browser.search" }],
      }),
      listResources: async (options) => ({
        connectionId: options.input.connectionId,
        resources: [{ uri: "memory://guide", name: "Guide" }],
      }),
      readResource: async (options) => ({
        connectionId: options.input.connectionId,
        uri: options.input.uri,
        contents: [{ type: "text", text: "resource-body" }],
      }),
      listPrompts: async () => {
        throw new Error("not used");
      },
      getPrompt: async () => {
        throw new Error("not used");
      },
      call: async (options) => ({
        connectionId: options.input.connectionId,
        toolName: options.input.toolName,
        content: [{ type: "text", text: "ok" }],
        isError: false,
      }),
      serve: () => {
        throw new Error("not used");
      },
    },
  };
}

test("mcp adapter supports the first-wave MCP actions", () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });

  assert.equal(adapter.supports(createPlan("mcp.call", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: { connectionId: "conn-1", toolName: "browser.search" },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.listTools", {
    route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
    input: { connectionId: "conn-1" },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.listResources", {
    route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
    input: { connectionId: "conn-1" },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.readResource", {
    route: { provider: "deepmind", model: "gemini-2.5-flash" },
    input: { connectionId: "conn-1", uri: "memory://resource" },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.native.execute", {
    route: { provider: "openai", model: "gpt-5.4", layer: "agent" },
    input: {
      transport: {
        kind: "stdio",
        command: "node",
      },
    },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.connect", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: {
      transport: {
        kind: "stdio",
        command: "node",
      },
    },
  })), false);
  assert.equal(adapter.supports(createPlan("mcp.configure", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: {
      transport: {
        kind: "stdio",
        command: "node",
      },
    },
  })), false);
});

test("mcp adapter groups listTools, listResources, and readResource into the read family", () => {
  assert.deepEqual(MCP_READ_FAMILY_ACTIONS, ["mcp.listTools", "mcp.listResources", "mcp.readResource"]);
  assert.equal(isMcpReadFamilyAction("mcp.listTools"), true);
  assert.equal(isMcpReadFamilyAction("mcp.listResources"), true);
  assert.equal(isMcpReadFamilyAction("mcp.readResource"), true);
  assert.equal(isMcpReadFamilyAction("mcp.call"), false);
});

test("mcp adapter prepares and executes shared-runtime MCP actions", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const lease = createLease();
  const prepared = await adapter.prepare(
    createPlan("mcp.call", {
      route: { provider: "openai", model: "gpt-5.4" },
      input: {
        connectionId: "conn-1",
        serverName: "browser",
        toolName: "browser.search",
        arguments: { q: "Praxis" },
      },
    }),
    lease,
  );

  assert.equal(prepared.executionMode, "direct");
  assert.equal(prepared.metadata?.riskLevel, "risky");
  assert.equal(prepared.metadata?.recommendedMode, "standard");
  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { toolName: string }).toolName, "browser.search");
  assert.equal((result.output as { qualifiedToolName?: string }).qualifiedToolName, "mcp_browser_browser.search");
  assert.equal(result.metadata?.provider, "openai");
  assert.equal(result.metadata?.riskLevel, "risky");
  assert.equal(result.metadata?.selectedBackend, "openai-codex-style-mcp-call");
});

test("mcp adapter accepts Gemini-style qualified tool names and preserves normalized tool identity", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const prepared = await adapter.prepare(
    createPlan("mcp.call", {
      route: { provider: "deepmind", model: "gemini-2.5-flash" },
      input: {
        connectionId: "conn-1",
        toolName: "mcp_playwright_browser_snapshot",
        arguments: { depth: 2 },
      },
    }),
    createLease(),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { toolName: string }).toolName, "browser_snapshot");
  assert.equal((result.output as { serverName?: string }).serverName, "playwright");
  assert.equal((result.output as { qualifiedToolName?: string }).qualifiedToolName, "mcp_playwright_browser_snapshot");
  assert.equal(result.metadata?.selectedBackend, "gemini-cli-mcp-call");
});

test("mcp adapter normalizes MCP call results into stable structured envelopes", async () => {
  const facade = createFacadeDouble();
  facade.mcp.call = async (options) => ({
    connectionId: options.input.connectionId,
    toolName: options.input.toolName,
    raw: {
      content: [{ type: "text", text: "ok" }],
      structuredContent: { value: 1 },
      _meta: { source: "test" },
    },
  });

  const adapter = createRaxMcpCapabilityAdapter({ facade });
  const prepared = await adapter.prepare(
    createPlan("mcp.call", {
      route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
      input: {
        connectionId: "conn-1",
        serverName: "playwright",
        toolName: "browser.snapshot",
        arguments: {},
      },
    }),
    createLease(),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.deepEqual((result.output as { content?: unknown[] }).content, [{ type: "text", text: "ok" }]);
  assert.deepEqual(
    (result.output as { structuredContent?: Record<string, unknown> }).structuredContent,
    { value: 1 },
  );
  assert.deepEqual((result.output as { _meta?: Record<string, unknown> })._meta, { source: "test" });
  assert.equal(result.metadata?.selectedBackend, "anthropic-claude-code-mcp-call");
});

test("mcp adapter auto-resolves the only connection for mcp.call when connectionId is omitted", async () => {
  const facade = createFacadeDouble();
  facade.mcp.listConnections = () => [{
    connectionId: "conn-only",
    provider: "openai",
    model: "gpt-5.4",
    layer: "api",
    shellId: "shell-openai-api",
    officialCarrier: "openai-responses",
    carrierKind: "shared-runtime",
    loweringMode: "shared-runtime",
    transportKind: "stdio",
  }];

  const adapter = createRaxMcpCapabilityAdapter({ facade });
  const prepared = await adapter.prepare(
    createPlan("mcp.call", {
      route: { provider: "openai", model: "gpt-5.4" },
      input: {
        serverName: "browser",
        toolName: "browser.search",
        arguments: { q: "Praxis" },
      },
    }),
    createLease(),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { connectionId?: string }).connectionId, "conn-only");
});

test("mcp adapter auto-resolves the only connection for mcp.listTools when connectionId is omitted", async () => {
  const facade = createFacadeDouble();
  facade.mcp.listConnections = () => [{
    connectionId: "conn-tools",
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "api",
    shellId: "shell-anthropic-api",
    officialCarrier: "anthropic-messages",
    carrierKind: "shared-runtime",
    loweringMode: "shared-runtime",
    transportKind: "streamable-http",
  }];

  const adapter = createRaxMcpCapabilityAdapter({ facade });
  const prepared = await adapter.prepare(
    createPlan("mcp.listTools", {
      route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
      input: {},
    }),
    createLease(),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { connectionId?: string }).connectionId, "conn-tools");
});

test("mcp adapter prepares and executes mcp.listResources through the shared runtime", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const prepared = await adapter.prepare(
    createPlan("mcp.listResources", {
      route: { provider: "openai", model: "gpt-5.4" },
      input: {
        connectionId: "conn-resources",
      },
    }),
    createLease(),
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal(
    (result.output as { resources: Array<{ uri: string }> }).resources[0]?.uri,
    "memory://guide",
  );
  assert.equal(result.metadata?.capability, "mcp.listResources");
  assert.equal(result.metadata?.actionFamily, "read");
  assert.equal((result.metadata as { resourceCount?: number } | undefined)?.resourceCount, 1);
});

test("mcp adapter prepares and executes the MCP read family through the shared runtime", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const lease = createLease();

  const listToolsPrepared = await adapter.prepare(
    createPlan("mcp.listTools", {
      route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
      input: {
        connectionId: "conn-read-1",
      },
    }),
    lease,
  );
  const listToolsResult = await adapter.execute(listToolsPrepared);
  assert.equal(listToolsPrepared.executionMode, "direct");
  assert.equal(listToolsResult.status, "success");
  assert.equal(
    (listToolsResult.output as { tools: Array<{ name: string }> }).tools[0]?.name,
    "browser.search",
  );
  assert.equal(listToolsResult.metadata?.capability, "mcp.listTools");
  assert.equal(listToolsResult.metadata?.actionFamily, "read");
  assert.equal(listToolsResult.metadata?.toolCount, 1);

  const readResourcePrepared = await adapter.prepare(
    createPlan("mcp.readResource", {
      route: { provider: "deepmind", model: "gemini-2.5-flash" },
      input: {
        connectionId: "conn-read-2",
        uri: "memory://resource",
      },
    }),
    lease,
  );
  const readResourceResult = await adapter.execute(readResourcePrepared);
  assert.equal(readResourcePrepared.executionMode, "direct");
  assert.equal(readResourceResult.status, "success");
  assert.equal(
    (readResourceResult.output as { contents: Array<{ text: string }> }).contents[0]?.text,
    "resource-body",
  );
  assert.equal(readResourceResult.metadata?.capability, "mcp.readResource");
  assert.equal(readResourceResult.metadata?.actionFamily, "read");
  assert.equal(readResourceResult.metadata?.uri, "memory://resource");
});

test("mcp adapter prepares and executes native MCP actions through native.build + execute", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const lease = createLease();
  const prepared = await adapter.prepare(
    createPlan("mcp.native.execute", {
      route: { provider: "openai", model: "gpt-5.4", layer: "agent" },
      input: {
        transport: {
          kind: "stdio",
          command: "node",
          args: ["server.js"],
        },
      },
    }),
    lease,
  );

  assert.equal(prepared.executionMode, "long-running");
  assert.equal(prepared.metadata?.riskLevel, "risky");
  assert.equal(prepared.metadata?.recommendedMode, "restricted");
  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { ok: boolean }).ok, true);
  assert.equal(result.metadata?.capability, "mcp.native.execute");
  assert.equal(
    (result.metadata as { humanGateRequirements?: string[] } | undefined)?.humanGateRequirements?.[0],
    "operator_review_required_before_native_transport_execution",
  );
});

test("mcp adapter publishes packaged capability metadata for thick MCP actions", () => {
  const callManifest = createRaxMcpCapabilityManifest({
    capabilityKey: "mcp.call",
  });
  const nativeManifest = createRaxMcpCapabilityManifest({
    capabilityKey: "mcp.native.execute",
  });

  assert.equal(callManifest.metadata?.riskLevel, "risky");
  assert.equal(callManifest.metadata?.recommendedMode, "standard");
  assert.equal(
    (callManifest.metadata?.capabilityPackage as { manifest?: { capabilityKey?: string } }).manifest?.capabilityKey,
    "mcp.call",
  );
  assert.equal(nativeManifest.supportsCancellation, true);
  assert.equal(nativeManifest.metadata?.recommendedMode, "restricted");
});

test("mcp activation factory materializes package-backed adapters across the MCP family", async () => {
  const facade = createFacadeDouble();
  const resolver = createActivationFactoryResolver();
  const factory = createRaxMcpActivationFactory({ facade });
  resolver.register("factory:rax.mcp.adapter", factory);
  resolver.register("factory:mcp-call", factory);
  resolver.register("factory:mcp-native-execute", factory);

  const packages = [
    createMcpReadCapabilityPackage({ capabilityKey: "mcp.listTools" }),
    createMcpReadCapabilityPackage({ capabilityKey: "mcp.readResource" }),
    createMcpCapabilityPackage({ capabilityKey: "mcp.call" }),
    createMcpCapabilityPackage({ capabilityKey: "mcp.native.execute" }),
  ];

  for (const capabilityPackage of packages) {
    const materialized = await materializeActivationRegistration({
      capabilityPackage,
      factoryResolver: resolver,
      capabilityIdPrefix: "capability",
    });

    const plan = createPlan(
      capabilityPackage.manifest.capabilityKey,
      createInputForCapability(capabilityPackage.manifest.capabilityKey),
    );
    const prepared = await materialized.adapter.prepare(plan, createLease());

    assert.equal(materialized.adapter.id, "rax.mcp.adapter");
    assert.equal(materialized.targetPool, "ta-capability-pool");
    assert.equal(prepared.capabilityKey, capabilityPackage.manifest.capabilityKey);
  }
});

test("mcp activation factory rejects unsupported capability surfaces", () => {
  const factory = createRaxMcpActivationFactory({
    facade: createFacadeDouble(),
  });

  assert.throws(
    () =>
      factory({
        manifest: {
          capabilityId: "capability:mcp.configure:1",
          capabilityKey: "mcp.configure",
          kind: "tool",
          version: "1.0.0",
          generation: 1,
          description: "unsupported",
        },
      }),
    /requires one of mcp\.listTools, mcp\.listResources, mcp\.readResource, mcp\.call, or mcp\.native\.execute/i,
  );
});

test("registerRaxMcpCapabilities registers the full MCP family with shared truthfulness metadata", () => {
  const registrations: Array<{
    capabilityKey: string;
    adapterId: string;
    metadata?: Record<string, unknown>;
  }> = [];
  const factories = new Map<string, ReturnType<typeof createRaxMcpActivationFactory>>();
  const result = registerRaxMcpCapabilities({
    runtime: {
      registerCapabilityAdapter(manifest, adapter) {
        registrations.push({
          capabilityKey: manifest.capabilityKey,
          adapterId: adapter.id,
          metadata: manifest.metadata,
        });
        return {
          bindingId: `binding:${manifest.capabilityKey}`,
        };
      },
      registerTaActivationFactory(ref, factory) {
        factories.set(ref, factory);
      },
    },
    facade: createFacadeDouble(),
  });

  assert.deepEqual(result.capabilityKeys, [...RAX_MCP_CAPABILITY_KEYS]);
  assert.equal(result.packages.length, 5);
  assert.equal(result.manifests.length, 5);
  assert.equal(result.bindings.length, 5);
  assert.equal(result.adapter.id, "rax.mcp.adapter");
  assert.deepEqual(
    registrations.map((entry) => entry.capabilityKey),
    [...RAX_MCP_CAPABILITY_KEYS],
  );
  assert.ok(registrations.every((entry) => entry.adapterId === "rax.mcp.adapter"));
  assert.deepEqual(
    [...factories.keys()],
    ["factory:rax.mcp.adapter", "factory:mcp-call", "factory:mcp-native-execute"],
  );
  assert.deepEqual(result.activationFactoryRefs, [...factories.keys()]);
  assert.equal(registrations[0]?.metadata?.riskProfile, "read-only");
  assert.equal(registrations[3]?.metadata?.truthfulness, "shared-runtime-call");
  assert.equal(
    registrations[4]?.metadata?.truthfulness,
    "provider-native-execute",
  );
});

test("mcp adapter rejects stdio native execution requests without a command", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });

  await assert.rejects(
    () => adapter.prepare(
      createPlan("mcp.native.execute", {
        route: { provider: "openai", model: "gpt-5.4", layer: "agent" },
        input: {
          transport: {
            kind: "stdio",
          },
        },
      }),
      createLease(),
    ),
    /stdio transport requires a non-empty command/i,
  );
});

test("mcp adapter rejects streamable-http native execution requests without a url", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });

  await assert.rejects(
    () => adapter.prepare(
      createPlan("mcp.native.execute", {
        route: { provider: "openai", model: "gpt-5.4", layer: "agent" },
        input: {
          transport: {
            kind: "streamable-http",
          },
        },
      }),
      createLease(),
    ),
    /streamable-http transport requires a non-empty url/i,
  );
});

test("mcp adapter returns failed envelope when prepared payload is missing", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });

  const result = await adapter.execute({
    preparedId: "missing",
    leaseId: "lease-1",
    capabilityKey: "mcp.call",
    bindingId: "binding-1",
    generation: 1,
    executionMode: "direct",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "rax_mcp_prepared_payload_missing");
});
