import assert from "node:assert/strict";
import test from "node:test";

import type { RaxFacade } from "../../rax/facade.js";
import type { OpenAIAgentNativeMcpPreparePayload } from "../../rax/mcp-types.js";
import type { CapabilityInvocationPlan, CapabilityLease } from "../capability-types/index.js";
import { createRaxMcpCapabilityAdapter } from "./rax-mcp-adapter.js";

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

function createFacadeDouble(): Pick<RaxFacade, "mcp"> {
  return {
    mcp: {
      shared: {
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
        listResources: async () => {
          throw new Error("not used");
        },
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
      } satisfies RaxFacade["mcp"]["shared"],
      native: {
        prepare: () => {
          const payload: OpenAIAgentNativeMcpPreparePayload = {
            carrier: {
              type: "openai-agents-mcp",
              shape: "agent-local-stdio",
            },
            toolsOnly: true,
            mcpServer: {
              transport: "stdio",
              command: "node",
              args: ["server.js"],
            },
          };
          return {
            provider: "openai",
            model: "gpt-5.4",
            layer: "agent",
            shellId: "openai-mcp-agent-shell",
            builderId: "openai.agent.openai-agents-mcp",
            officialCarrier: "openai-agents-mcp",
            carrierKind: "provider-native",
            loweringMode: "provider-native-agent",
            transportKind: "stdio",
            supported: true,
            constraintSnapshot: {
              nativeSupportedTransports: ["stdio"],
              supportsResources: false,
              supportsPrompts: false,
              supportsServe: false,
            },
            supportsResources: false,
            supportsPrompts: false,
            supportsServe: false,
            sdkPackageName: "@test/mcp",
            entrypoint: "native.build",
            payload,
            notes: ["native plan"],
          };
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
        throw new Error("legacy compatibility alias should not be used");
      },
      connect: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
      listConnections: () => [],
      disconnect: async () => {},
      disconnectAll: async () => {},
      listTools: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
      listResources: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
      readResource: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
      listPrompts: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
      getPrompt: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
      call: async () => {
        throw new Error("legacy compatibility alias should not be used");
      },
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

  assert.equal(adapter.supports(createPlan("mcp.shared.call", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: { connectionId: "conn-1", toolName: "browser.search" },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.shared.listTools", {
    route: { provider: "anthropic", model: "claude-opus-4-6-thinking" },
    input: { connectionId: "conn-1" },
  })), true);
  assert.equal(adapter.supports(createPlan("mcp.shared.readResource", {
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
  assert.equal(adapter.supports(createPlan("mcp.call", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: { connectionId: "conn-1", toolName: "browser.search" },
  })), true);
  assert.equal(adapter.supports(createPlan("computer.use", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: { connectionId: "conn-1", toolName: "browser_navigate" },
  })), true);
  assert.equal(adapter.supports(createPlan("computer.observe", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: { connectionId: "conn-1", toolName: "browser_snapshot" },
  })), true);
  assert.equal(adapter.supports(createPlan("computer.act", {
    route: { provider: "openai", model: "gpt-5.4" },
    input: { connectionId: "conn-1", toolName: "browser_click" },
  })), true);
});

test("mcp adapter prepares and executes shared-runtime MCP actions", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const lease = createLease();
  const prepared = await adapter.prepare(
    createPlan("mcp.shared.call", {
      route: { provider: "openai", model: "gpt-5.4" },
      input: {
        connectionId: "conn-1",
        toolName: "browser.search",
        arguments: { q: "Praxis" },
      },
    }),
    lease,
  );

  assert.equal(prepared.executionMode, "direct");
  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { toolName: string }).toolName, "browser.search");
  assert.equal(result.metadata?.provider, "openai");
  assert.equal(result.metadata?.capability, "mcp.shared.call");
  const capabilityPackage = result.metadata?.capabilityPackage as { capabilityKey?: string } | undefined;
  assert.equal(capabilityPackage?.capabilityKey, "mcp.shared.call");
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
  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { ok: boolean }).ok, true);
  assert.equal(result.metadata?.capability, "mcp.native.execute");
  const capabilityPackage = result.metadata?.capabilityPackage as {
    carrier?: { officialCarrier?: string };
  } | undefined;
  assert.equal(capabilityPackage?.carrier?.officialCarrier, "openai-agents-mcp");
});

test("mcp adapter normalizes legacy shared actions to mcp.shared.*", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const lease = createLease();
  const prepared = await adapter.prepare(
    createPlan("mcp.call", {
      route: { provider: "openai", model: "gpt-5.4" },
      input: {
        connectionId: "conn-legacy",
        toolName: "browser.search",
      },
    }),
    lease,
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal(result.metadata?.capability, "mcp.shared.call");
  assert.equal(result.metadata?.capabilityAlias, "mcp.call");
  const capabilityPackage = result.metadata?.capabilityPackage as {
    compatibilityAliases?: string[];
  } | undefined;
  assert.deepEqual(capabilityPackage?.compatibilityAliases, ["mcp.call"]);
});

test("mcp adapter normalizes computer actions onto mcp.shared.call", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });
  const lease = createLease();
  const prepared = await adapter.prepare(
    createPlan("computer.use", {
      route: { provider: "openai", model: "gpt-5.4" },
      input: {
        connectionId: "conn-computer",
        toolName: "browser_navigate",
        arguments: { url: "https://example.com" },
      },
    }),
    lease,
  );

  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal(result.metadata?.capability, "computer.use");
  assert.equal(result.metadata?.dispatchCapability, "mcp.shared.call");
  assert.equal(result.metadata?.capabilityAlias, undefined);
  const capabilityPackage = result.metadata?.capabilityPackage as {
    capabilityKey?: string;
    entryFamily?: string;
    backingCapability?: string;
    carrierEntryFamilies?: string[];
  } | undefined;
  assert.equal(capabilityPackage?.capabilityKey, "computer.use");
  assert.equal(capabilityPackage?.entryFamily, "computer");
  assert.equal(capabilityPackage?.backingCapability, "mcp.shared.call");
  assert.deepEqual(capabilityPackage?.carrierEntryFamilies, ["mcp.shared", "mcp.native"]);
});

test("mcp adapter returns failed envelope when prepared payload is missing", async () => {
  const adapter = createRaxMcpCapabilityAdapter({
    facade: createFacadeDouble(),
  });

  const result = await adapter.execute({
    preparedId: "missing",
    leaseId: "lease-1",
    capabilityKey: "mcp.shared.call",
    bindingId: "binding-1",
    generation: 1,
    executionMode: "direct",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "rax_mcp_prepared_payload_missing");
});
