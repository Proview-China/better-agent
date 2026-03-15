import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { RaxRoutingError } from "./errors.js";
import { createRaxFacade } from "./facade.js";
import { CapabilityRouter } from "./router.js";
import { McpRuntime } from "./mcp-runtime.js";

async function setupInMemoryMcpServer() {
  const server = new McpServer({ name: "test-mcp", version: "1.0.0" });
  server.registerTool(
    "echo",
    {
      description: "Echo tool",
      inputSchema: {
        text: z.string()
      }
    },
    async ({ text }) => {
      return {
        content: [
          {
            type: "text",
            text: `echo:${text}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "failing-tool",
    {
      description: "Failing tool",
      inputSchema: {}
    },
    async () => {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "intentional failure"
          }
        ]
      };
    }
  );

  server.registerResource(
    "project-readme",
    "file:///tmp/readme.md",
    {
      description: "Test resource",
      mimeType: "text/markdown"
    },
    async () => {
      return {
        contents: [
          {
            uri: "file:///tmp/readme.md",
            text: "# hello from mcp"
          }
        ]
      };
    }
  );

  server.registerPrompt(
    "summarize",
    {
      description: "Summarize a piece of text",
      argsSchema: {
        topic: z.string()
      }
    },
    async ({ topic }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Summarize ${topic}`
            }
          }
        ]
      };
    }
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  return {
    server,
    clientTransport
  };
}

test("mcp.connect succeeds and returns a connection summary", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    const connection = await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "test-connection",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    assert.equal(connection.connectionId, "test-connection");
    assert.equal(connection.provider, "anthropic");
    assert.equal(connection.transportKind, "in-memory");
    assert.equal(connection.serverVersion?.name, "test-mcp");
  } finally {
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      connectionId: "test-connection"
    });
    await server.close();
  }
});

test("mcp.connect classifies a failed transport launch", async () => {
  const runtime = new McpRuntime();

  await assert.rejects(
    () =>
      runtime.connect({
        provider: "openai",
        model: "gpt-5",
        layer: "agent",
        input: {
          transport: {
            kind: "stdio",
            command: "definitely-not-a-real-command"
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_connection_failed");
      return true;
    }
  );
});

test("mcp.listTools returns normalized tool metadata", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "test-list-tools",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.listTools({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "test-list-tools"
      }
    });

    assert.equal(result.tools.length, 2);
    const toolNames = result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, ["echo", "failing-tool"]);
  } finally {
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      connectionId: "test-list-tools"
    });
    await server.close();
  }
});

test("mcp.listTools fails on a missing connection", async () => {
  const runtime = new McpRuntime();

  await assert.rejects(
    () =>
      runtime.listTools({
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        layer: "api",
        input: {
          connectionId: "missing"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_not_connected");
      return true;
    }
  );
});

test("mcp.call returns a normalized tool result", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "agent",
      input: {
        connectionId: "test-call",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.call({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "agent",
      input: {
        connectionId: "test-call",
        toolName: "echo",
        arguments: {
          text: "hello"
        }
      }
    });

    assert.equal(result.toolName, "echo");
    assert.equal(
      (result.content?.[0] as { text?: string } | undefined)?.text,
      "echo:hello"
    );
  } finally {
    await runtime.disconnect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "agent",
      connectionId: "test-call"
    });
    await server.close();
  }
});

test("mcp.call classifies missing tool and missing connection separately", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "test-missing-tool",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    await assert.rejects(
      () =>
        runtime.call({
          provider: "openai",
          model: "gpt-5",
          layer: "agent",
          input: {
            connectionId: "test-missing-tool",
            toolName: "missing-tool"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_tool_not_found");
        return true;
      }
    );

    await assert.rejects(
      () =>
        runtime.call({
          provider: "openai",
          model: "gpt-5",
          layer: "agent",
          input: {
            connectionId: "missing-connection",
            toolName: "echo"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_not_connected");
        return true;
      }
    );
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "test-missing-tool"
    });
    await server.close();
  }
});

test("mcp.listResources returns normalized resource metadata", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "test-list-resources",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.listResources({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "test-list-resources"
      }
    });

    assert.equal(result.resources.length, 1);
    assert.equal(result.resources[0]?.name, "project-readme");
    assert.equal(result.resources[0]?.mimeType, "text/markdown");
  } finally {
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      connectionId: "test-list-resources"
    });
    await server.close();
  }
});

test("mcp.readResource returns normalized contents", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "test-read-resource",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.readResource({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "test-read-resource",
        uri: "file:///tmp/readme.md"
      }
    });

    assert.equal(result.uri, "file:///tmp/readme.md");
    assert.equal(
      (result.contents[0] as { text?: string } | undefined)?.text,
      "# hello from mcp"
    );
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "test-read-resource"
    });
    await server.close();
  }
});

test("mcp.listPrompts returns normalized prompt metadata", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "agent",
      input: {
        connectionId: "test-list-prompts",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.listPrompts({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "agent",
      input: {
        connectionId: "test-list-prompts"
      }
    });

    assert.equal(result.prompts.length, 1);
    assert.equal(result.prompts[0]?.name, "summarize");
    assert.equal(result.prompts[0]?.arguments?.[0]?.name, "topic");
  } finally {
    await runtime.disconnect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "agent",
      connectionId: "test-list-prompts"
    });
    await server.close();
  }
});

test("mcp.getPrompt returns normalized prompt messages", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "test-get-prompt",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.getPrompt({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "test-get-prompt",
        name: "summarize",
        arguments: {
          topic: "MCP"
        }
      }
    });

    assert.equal(result.name, "summarize");
    assert.equal(result.messages.length, 1);
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "test-get-prompt"
    });
    await server.close();
  }
});

test("mcp.connect replaces duplicate connection ids after closing the old client", async () => {
  const runtime = new McpRuntime();
  const first = await setupInMemoryMcpServer();
  const second = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "duplicate-id",
        transport: {
          kind: "in-memory",
          transport: first.clientTransport
        }
      }
    });

    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      input: {
        connectionId: "duplicate-id",
        transport: {
          kind: "in-memory",
          transport: second.clientTransport
        }
      }
    });

    assert.deepEqual(runtime.listConnectionIds(), ["duplicate-id"]);
  } finally {
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      connectionId: "duplicate-id"
    });
    await first.server.close();
    await second.server.close();
  }
});

test("mcp.connect rejects an explicit layer that conflicts with the provider shell", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await assert.rejects(
      () =>
        runtime.connect({
          provider: "openai",
          model: "gpt-5",
          layer: "api",
          input: {
            connectionId: "bad-layer",
            transport: {
              kind: "in-memory",
              transport: clientTransport
            }
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_layer_mismatch");
        return true;
      }
    );
  } finally {
    await server.close();
  }
});

test("mcp.listConnections only returns entries inside the requested route scope", async () => {
  const runtime = new McpRuntime();
  const anthropic = await setupInMemoryMcpServer();
  const openai = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      compatibilityProfileId: "anthropic-official",
      input: {
        connectionId: "anthropic-scoped",
        transport: {
          kind: "in-memory",
          transport: anthropic.clientTransport
        }
      }
    });

    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "openai-scoped",
        transport: {
          kind: "in-memory",
          transport: openai.clientTransport
        }
      }
    });

    const result = runtime.listConnections({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      compatibilityProfileId: "anthropic-official"
    });

    assert.deepEqual(
      result.map((entry) => entry.connectionId),
      ["anthropic-scoped"]
    );
  } finally {
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      compatibilityProfileId: "anthropic-official",
      connectionId: "anthropic-scoped"
    });
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "openai-scoped"
    });
    await anthropic.server.close();
    await openai.server.close();
  }
});

test("mcp.disconnectAll only tears down entries inside the requested route scope", async () => {
  const runtime = new McpRuntime();
  const anthropic = await setupInMemoryMcpServer();
  const openai = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      compatibilityProfileId: "anthropic-official",
      input: {
        connectionId: "anthropic-disconnect-all",
        transport: {
          kind: "in-memory",
          transport: anthropic.clientTransport
        }
      }
    });

    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "openai-disconnect-all",
        transport: {
          kind: "in-memory",
          transport: openai.clientTransport
        }
      }
    });

    await runtime.disconnectAll({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "api",
      compatibilityProfileId: "anthropic-official"
    });

    assert.deepEqual(runtime.listConnectionIds(), ["openai-disconnect-all"]);
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "openai-disconnect-all"
    });
    await anthropic.server.close();
    await openai.server.close();
  }
});

test("mcp.call returns remote tool errors instead of collapsing them into transport failures", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "tool-error",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const result = await runtime.call({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "tool-error",
        toolName: "failing-tool",
        arguments: {}
      }
    });

    assert.equal(result.isError, true);
    assert.equal(result.errorMessage, "MCP tool failing-tool reported an execution error.");
    assert.equal(
      (result.content?.[0] as { text?: string } | undefined)?.text,
      "intentional failure"
    );
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "tool-error"
    });
    await server.close();
  }
});

test("facade mcp operations enforce provider, model, layer, and profile routing constraints", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await raxFacade.mcp.connect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      compatibilityProfileId: "anthropic-messages-only-primary",
      input: {
        connectionId: "facade-route",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    await assert.rejects(
      () =>
        raxFacade.mcp.listTools({
          provider: "openai",
          model: "gpt-5",
          layer: "agent",
          input: {
            connectionId: "facade-route"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_route_mismatch");
        return true;
      }
    );
  } finally {
    await raxFacade.mcp.disconnect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      compatibilityProfileId: "anthropic-messages-only-primary",
      input: {
        connectionId: "facade-route"
      }
    });
    await server.close();
  }
});

test("facade mcp lifecycle management stays scoped to the requested route", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);
  const anthropic = await setupInMemoryMcpServer();
  const openai = await setupInMemoryMcpServer();

  try {
    await raxFacade.mcp.connect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      compatibilityProfileId: "anthropic-messages-only-primary",
      input: {
        connectionId: "facade-anthropic-scoped",
        transport: {
          kind: "in-memory",
          transport: anthropic.clientTransport
        }
      }
    });

    await raxFacade.mcp.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "facade-openai-scoped",
        transport: {
          kind: "in-memory",
          transport: openai.clientTransport
        }
      }
    });

    const anthropicConnections = raxFacade.mcp.listConnections({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      compatibilityProfileId: "anthropic-messages-only-primary",
      input: {}
    });

    assert.deepEqual(
      anthropicConnections.map((entry) => entry.connectionId),
      ["facade-anthropic-scoped"]
    );

    await raxFacade.mcp.disconnectAll({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      compatibilityProfileId: "anthropic-messages-only-primary",
      input: {}
    });

    const openaiConnections = raxFacade.mcp.listConnections({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {}
    });

    assert.deepEqual(
      openaiConnections.map((entry) => entry.connectionId),
      ["facade-openai-scoped"]
    );
  } finally {
    await raxFacade.mcp.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "facade-openai-scoped"
      }
    });
    await anthropic.server.close();
    await openai.server.close();
  }
});

test("facade mcp.use returns a session handle that can access tools resources prompts and close itself", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    const session = await raxFacade.mcp.use({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      compatibilityProfileId: "anthropic-messages-only-primary",
      input: {
        connectionId: "session-handle",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    assert.equal(session.connection.connectionId, "session-handle");
    assert.equal(session.connection.layer, "api");

    const tools = await session.tools();
    assert.ok(tools.tools.some((tool) => tool.name === "echo"));

    const toolResult = await session.call({
      toolName: "echo",
      arguments: {
        text: "from-session"
      }
    });
    assert.equal(
      (toolResult.content?.[0] as { text?: string } | undefined)?.text,
      "echo:from-session"
    );

    const resources = await session.resources();
    assert.equal(resources.resources[0]?.uri, "file:///tmp/readme.md");

    const resource = await session.read({
      uri: "file:///tmp/readme.md"
    });
    assert.equal(
      (resource.contents[0] as { text?: string } | undefined)?.text,
      "# hello from mcp"
    );

    const prompts = await session.prompts();
    assert.equal(prompts.prompts[0]?.name, "summarize");

    const prompt = await session.prompt({
      name: "summarize",
      arguments: {
        topic: "session"
      }
    });
    assert.equal(prompt.messages.length, 1);

    await session.disconnect();

    await assert.rejects(
      () => session.tools(),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_not_connected");
        return true;
      }
    );
  } finally {
    await server.close();
  }
});

test("facade mcp.use works across openai anthropic and deepmind routes without changing upper-level API", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);
  const providerTargets = [
    { provider: "openai" as const, model: "gpt-5", expectedLayer: "agent" as const },
    { provider: "anthropic" as const, model: "claude-sonnet-4-6", expectedLayer: "api" as const },
    { provider: "deepmind" as const, model: "gemini-2.5-pro", expectedLayer: "agent" as const }
  ];

  const servers = await Promise.all(providerTargets.map(() => setupInMemoryMcpServer()));

  try {
    for (const [index, target] of providerTargets.entries()) {
      const session = await raxFacade.mcp.use({
        provider: target.provider,
        model: target.model,
        input: {
          connectionId: `provider-session-${target.provider}`,
          transport: {
            kind: "in-memory",
            transport: servers[index]!.clientTransport
          }
        }
      });

      assert.equal(session.connection.layer, target.expectedLayer);

      const tools = await session.tools();
      assert.ok(tools.tools.some((tool) => tool.name === "echo"));

      const result = await session.call({
        toolName: "echo",
        arguments: {
          text: target.provider
        }
      });
      assert.equal(
        (result.content?.[0] as { text?: string } | undefined)?.text,
        `echo:${target.provider}`
      );

      await session.disconnect();
    }
  } finally {
    await Promise.all(servers.map(async ({ server }) => server.close()));
  }
});
