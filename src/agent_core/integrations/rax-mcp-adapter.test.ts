import assert from "node:assert/strict";
import test from "node:test";

import type { RaxFacade } from "../../rax/facade.js";
import type { CapabilityInvocationPlan, CapabilityLease } from "../capability-types/index.js";
import {
  MCP_READ_FAMILY_ACTIONS,
  createRaxMcpCapabilityAdapter,
  isMcpReadFamilyAction,
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
});

test("mcp adapter groups listTools and readResource into the read family", () => {
  assert.deepEqual(MCP_READ_FAMILY_ACTIONS, ["mcp.listTools", "mcp.readResource"]);
  assert.equal(isMcpReadFamilyAction("mcp.listTools"), true);
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
  const result = await adapter.execute(prepared);
  assert.equal(result.status, "success");
  assert.equal((result.output as { ok: boolean }).ok, true);
  assert.equal(result.metadata?.capability, "mcp.native.execute");
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
