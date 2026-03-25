import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { PreparedInvocation } from "./contracts.js";
import { RaxRoutingError } from "./errors.js";
import { createRaxFacade } from "./facade.js";
import { CapabilityRouter } from "./router.js";
import { rax } from "./runtime.js";
import { McpRuntime } from "./mcp-runtime.js";

async function setupInMemoryMcpServer(options: { serverName?: string } = {}) {
  const server = new McpServer({
    name: options.serverName ?? "test-mcp",
    version: "1.0.0"
  });
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
    assert.equal(connection.carrierKind, "shared-runtime");
    assert.equal(connection.transportKind, "in-memory");
    assert.equal(connection.shellId, "anthropic-mcp-api-shell");
    assert.equal(connection.officialCarrier, "anthropic-api-mcp-connector");
    assert.equal(connection.loweringMode, "shared-runtime");
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

test("mcp.connect keeps startup connection-closed failures on the connection_failed lane", async () => {
  const runtime = new McpRuntime();
  const runtimeHack = runtime as unknown as {
    createTransport(config: unknown): unknown;
  };

  runtimeHack.createTransport = () => ({
    start: async () => {
      throw new Error("connection closed during startup");
    },
    send: async () => undefined,
    close: async () => undefined,
    onclose: undefined,
    onerror: undefined,
    onmessage: undefined
  });

  await assert.rejects(
    () =>
      runtime.connect({
        provider: "openai",
        model: "gpt-5",
        layer: "agent",
        input: {
          transport: {
            kind: "in-memory",
            transport: {} as never
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
      layer: "agent",
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
      layer: "agent",
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
      layer: "agent",
      connectionId: "test-list-resources"
    });
    await server.close();
  }
});

test("anthropic api MCP keeps tools but rejects resources and prompts surfaces", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      input: {
        connectionId: "anthropic-api-tools-only",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const tools = await runtime.listTools({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      input: {
        connectionId: "anthropic-api-tools-only"
      }
    });
    assert.ok(tools.tools.some((tool) => tool.name === "echo"));

    await assert.rejects(
      () =>
        runtime.listResources({
          provider: "anthropic",
          model: "claude-opus-4-6-thinking",
          layer: "api",
          input: {
            connectionId: "anthropic-api-tools-only"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_surface_unsupported");
        return true;
      }
    );

    await assert.rejects(
      () =>
        runtime.listPrompts({
          provider: "anthropic",
          model: "claude-opus-4-6-thinking",
          layer: "api",
          input: {
            connectionId: "anthropic-api-tools-only"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_surface_unsupported");
        return true;
      }
    );
  } finally {
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "api",
      connectionId: "anthropic-api-tools-only"
    });
    await server.close();
  }
});

test("anthropic api MCP rejects stdio transport because the official connector is remote-first", async () => {
  const runtime = new McpRuntime();

  await assert.rejects(
    () =>
      runtime.connect({
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        layer: "api",
        input: {
          connectionId: "anthropic-api-stdio",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest", "--help"]
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_transport_unsupported");
      return true;
    }
  );
});

test("openai api MCP keeps tools but rejects stdio plus richer resources and prompts surfaces", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "api",
      input: {
        connectionId: "openai-api-tools-only",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const tools = await runtime.listTools({
      provider: "openai",
      model: "gpt-5",
      layer: "api",
      input: {
        connectionId: "openai-api-tools-only"
      }
    });
    assert.ok(tools.tools.some((tool) => tool.name === "echo"));

    await assert.rejects(
      () =>
        runtime.listResources({
          provider: "openai",
          model: "gpt-5",
          layer: "api",
          input: {
            connectionId: "openai-api-tools-only"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_surface_unsupported");
        return true;
      }
    );

    await assert.rejects(
      () =>
        runtime.listPrompts({
          provider: "openai",
          model: "gpt-5",
          layer: "api",
          input: {
            connectionId: "openai-api-tools-only"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_surface_unsupported");
        return true;
      }
    );
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "api",
      connectionId: "openai-api-tools-only"
    });
    await server.close();
  }

  await assert.rejects(
    () =>
      runtime.connect({
        provider: "openai",
        model: "gpt-5",
        layer: "api",
        input: {
          connectionId: "openai-api-stdio",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest", "--help"]
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_transport_unsupported");
      return true;
    }
  );
});

test("deepmind api MCP keeps tools but rejects resources and prompts surfaces", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "api",
      input: {
        connectionId: "deepmind-api-tools-only",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    const tools = await runtime.listTools({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "api",
      input: {
        connectionId: "deepmind-api-tools-only"
      }
    });
    assert.ok(tools.tools.some((tool) => tool.name === "echo"));

    await assert.rejects(
      () =>
        runtime.listResources({
          provider: "deepmind",
          model: "gemini-2.5-pro",
          layer: "api",
          input: {
            connectionId: "deepmind-api-tools-only"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_surface_unsupported");
        return true;
      }
    );

    await assert.rejects(
      () =>
        runtime.listPrompts({
          provider: "deepmind",
          model: "gemini-2.5-pro",
          layer: "api",
          input: {
            connectionId: "deepmind-api-tools-only"
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError);
        assert.equal(error.code, "mcp_surface_unsupported");
        return true;
      }
    );
  } finally {
    await runtime.disconnect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "api",
      connectionId: "deepmind-api-tools-only"
    });
    await server.close();
  }
});

test("mcp.readResource returns normalized contents", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    await runtime.connect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      layer: "agent",
      connectionId: "test-get-prompt"
    });
    await server.close();
  }
});

test("mcp.connect replaces duplicate connection ids only after the replacement client is ready", async () => {
  const runtime = new McpRuntime();
  const first = await setupInMemoryMcpServer({ serverName: "first-mcp" });
  const second = await setupInMemoryMcpServer({ serverName: "replacement-mcp" });

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

    const replacement = await runtime.connect({
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
    assert.equal(replacement.serverVersion?.name, "replacement-mcp");
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

test("mcp.connect keeps the old connection when duplicate-id replacement fails", async () => {
  const runtime = new McpRuntime();
  const { server, clientTransport } = await setupInMemoryMcpServer({
    serverName: "primary-mcp"
  });

  try {
    await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "duplicate-id",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    await assert.rejects(
      () =>
        runtime.connect({
          provider: "openai",
          model: "gpt-5",
          layer: "agent",
          input: {
            connectionId: "duplicate-id",
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

    assert.deepEqual(runtime.listConnectionIds(), ["duplicate-id"]);

    const tools = await runtime.listTools({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "duplicate-id"
      }
    });

    assert.equal(tools.tools[0]?.name, "echo");
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      connectionId: "duplicate-id"
    });
    await server.close();
  }
});

test("mcp.connect accepts explicit alternate layers when the provider has a matching carrier shell", async () => {
  const runtime = new McpRuntime();
  const openai = await setupInMemoryMcpServer();
  const anthropic = await setupInMemoryMcpServer();
  const deepmind = await setupInMemoryMcpServer();

  try {
    const openaiConnection = await runtime.connect({
      provider: "openai",
      model: "gpt-5",
      layer: "api",
      input: {
        connectionId: "openai-api-layer",
        transport: {
          kind: "in-memory",
          transport: openai.clientTransport
        }
      }
    });

    const anthropicConnection = await runtime.connect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "agent",
      input: {
        connectionId: "anthropic-agent-layer",
        transport: {
          kind: "in-memory",
          transport: anthropic.clientTransport
        }
      }
    });

    const deepmindConnection = await runtime.connect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "api",
      input: {
        connectionId: "deepmind-api-layer",
        transport: {
          kind: "in-memory",
          transport: deepmind.clientTransport
        }
      }
    });

    assert.equal(openaiConnection.layer, "api");
    assert.equal(anthropicConnection.layer, "agent");
    assert.equal(deepmindConnection.layer, "api");
  } finally {
    await runtime.disconnect({
      provider: "openai",
      model: "gpt-5",
      layer: "api",
      connectionId: "openai-api-layer"
    });
    await runtime.disconnect({
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      layer: "agent",
      connectionId: "anthropic-agent-layer"
    });
    await runtime.disconnect({
      provider: "deepmind",
      model: "gemini-2.5-pro",
      layer: "api",
      connectionId: "deepmind-api-layer"
    });
    await openai.server.close();
    await anthropic.server.close();
    await deepmind.server.close();
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
      layer: "agent",
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
    assert.equal(session.connection.layer, "agent");
    assert.equal(session.connection.carrierKind, "shared-runtime");
    assert.equal(session.connection.officialCarrier, "anthropic-agent-runtime-mcp");
    assert.equal(session.connection.loweringMode, "shared-runtime");

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

test("facade mcp.shared.use works as the explicit shared-runtime alias and mcp.native.prepare exposes the future split", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);
  const { server, clientTransport } = await setupInMemoryMcpServer();

  try {
    const session = await raxFacade.mcp.shared.use({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        connectionId: "shared-alias-session",
        transport: {
          kind: "in-memory",
          transport: clientTransport
        }
      }
    });

    assert.equal(session.connection.carrierKind, "shared-runtime");
    assert.equal(session.connection.shellId, "openai-mcp-agent-shell");

    const tools = await session.tools();
    assert.ok(tools.tools.some((tool) => tool.name === "echo"));

    const nativePlan = raxFacade.mcp.native.prepare({
      provider: "openai",
      model: "gpt-5",
      layer: "agent",
      input: {
        transport: {
          kind: "stdio",
          command: "npx",
          args: ["-y", "@playwright/mcp@latest", "--help"]
        }
      }
    });

    assert.equal(nativePlan.shellId, "openai-mcp-agent-shell");
    assert.equal(nativePlan.builderId, "openai.agent.openai-agents-mcp");
    assert.equal(nativePlan.carrierKind, "provider-native");
    assert.equal(nativePlan.loweringMode, "provider-native-agent");
    assert.equal(nativePlan.supported, true);
    assert.equal(nativePlan.supportsResources, false);
    assert.equal(nativePlan.supportsPrompts, false);
    assert.equal(nativePlan.sdkPackageName, "@openai/agents");
    assert.equal(nativePlan.entrypoint, "MCPServerStdio");
    assert.equal(
      ((nativePlan.payload as { carrier?: { shape?: string } } | undefined)?.carrier?.shape),
      "agent-local-stdio"
    );
    assert.equal(
      ((nativePlan.payload as { mcpServer?: { transport?: string } } | undefined)?.mcpServer?.transport),
      "stdio"
    );

    await session.disconnect();
  } finally {
    await server.close();
  }
});

test("facade mcp.native.prepare reports unsupported transports for official native carriers", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    input: {
      transport: {
        kind: "in-memory",
        transport: {} as never
      }
    }
  });

  assert.equal(plan.carrierKind, "provider-native");
  assert.equal(plan.builderId, "openai.api.openai-api-mcp");
  assert.equal(plan.loweringMode, "provider-native-api");
  assert.equal(plan.supported, false);
  assert.ok(Array.isArray(plan.unsupportedReasons));
  assert.match(plan.unsupportedReasons?.[0] ?? "", /transport in-memory/u);
  assert.deepEqual(plan.constraintSnapshot.nativeSupportedTransports, ["streamable-http"]);
  assert.equal(plan.supportsResources, false);
  assert.equal(plan.supportsPrompts, false);
  assert.equal(plan.sdkPackageName, undefined);
  assert.equal(plan.entrypoint, undefined);
});

test("facade mcp.native.prepare returns an OpenAI API Responses MCP payload for streamable-http", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    input: {
      connectionId: "openai-api-remote",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  assert.equal(plan.supported, true);
  assert.equal(plan.builderId, "openai.api.openai-api-mcp");
  assert.equal(plan.sdkPackageName, "openai");
  assert.equal(plan.entrypoint, "client.responses.create");
  assert.equal(
    ((plan.payload as { carrier?: { shape?: string } } | undefined)?.carrier?.shape),
    "responses-remote-mcp-tool"
  );
  assert.equal(
    (((plan.payload as { tools?: Array<{ type?: string }> } | undefined)?.tools?.[0])?.type),
    "mcp"
  );
});

test("facade mcp.native.prepare reports openai agent streamable-http as unsupported in the current execute baseline", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "openai",
    model: "gpt-5",
    layer: "agent",
    input: {
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp",
        headers: {
          authorization: "Bearer test"
        }
      }
    }
  });

  assert.equal(plan.supported, false);
  assert.equal(plan.builderId, "openai.agent.openai-agents-mcp");
  assert.match(plan.unsupportedReasons?.[0] ?? "", /streamable-http/u);
  assert.deepEqual(plan.constraintSnapshot.nativeSupportedTransports, ["stdio"]);
  assert.equal(plan.sdkPackageName, undefined);
  assert.equal(plan.entrypoint, undefined);
  assert.equal(plan.payload, undefined);
});

test("facade mcp.native.prepare returns an Anthropic API connector payload for streamable-http", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "api",
    input: {
      connectionId: "anthropic-api-remote",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  assert.equal(plan.supported, true);
  assert.equal(plan.builderId, "anthropic.api.anthropic-api-mcp-connector");
  assert.equal(plan.sdkPackageName, "@anthropic-ai/sdk");
  assert.equal(plan.entrypoint, "client.messages.create");
  assert.equal(
    ((plan.payload as { carrier?: { shape?: string } } | undefined)?.carrier?.shape),
    "messages-mcp-connector"
  );
  assert.equal(
    (((plan.payload as { tools?: Array<{ type?: string }> } | undefined)?.tools?.[0])?.type),
    "mcp_toolset"
  );
});

test("facade mcp.native.prepare exposes richer Anthropic agent carrier surface", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "agent",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  assert.equal(plan.carrierKind, "provider-native");
  assert.equal(plan.builderId, "anthropic.agent.anthropic-agent-runtime-mcp");
  assert.equal(plan.loweringMode, "provider-native-agent");
  assert.equal(plan.supported, true);
  assert.equal(plan.supportsResources, true);
  assert.equal(plan.supportsPrompts, true);
  assert.equal(plan.sdkPackageName, "@anthropic-ai/claude-agent-sdk");
  assert.equal(plan.entrypoint, "mcpServers");
  assert.ok(
    typeof (plan.payload as { mcpServers?: unknown } | undefined)?.mcpServers === "object"
  );
  assert.equal(
    ((plan.payload as { surface?: { resources?: { mode?: string } } } | undefined)?.surface?.resources?.mode),
    "runtime-mediated"
  );
  assert.equal(
    ((plan.payload as { surface?: { prompts?: { mode?: string } } } | undefined)?.surface?.prompts?.mode),
    "runtime-mediated"
  );
});

test("facade mcp.native.serve returns an Anthropic SDK MCP server config", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const result = raxFacade.mcp.native.serve({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "agent",
    input: {
      serverName: "praxis-inline-mcp",
      serverVersion: "0.1.0",
      tools: [
        {
          name: "echo",
          description: "Echo tool",
          inputSchema: {
            text: z.string()
          },
          handler: async (args) => ({
            content: [{ type: "text", text: String(args.text ?? "") }]
          })
        }
      ]
    }
  });

  assert.equal(result.supported, true);
  assert.equal(result.sdk?.packageName, "@anthropic-ai/claude-agent-sdk");
  assert.equal(result.sdk?.entrypoint, "createSdkMcpServer");
  const payload = result.payload as {
    serverConfig?: {
      type?: string;
      name?: string;
      instance?: { close?: () => Promise<void> };
    };
  };
  assert.equal(payload.serverConfig?.type, "sdk");
  assert.equal(payload.serverConfig?.name, "praxis-inline-mcp");
  await payload.serverConfig?.instance?.close?.();
});

test("facade mcp.native.serve reports OpenAI as unsupported in the current baseline", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const result = raxFacade.mcp.native.serve({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      serverName: "openai-inline-mcp"
    }
  });

  assert.equal(result.supported, false);
  assert.match(result.unsupportedReasons?.[0] ?? "", /OpenAI does not expose/i);
});

test("facade mcp.serve aliases mcp.native.serve", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const direct = raxFacade.mcp.serve({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      serverName: "deepmind-inline-mcp"
    }
  });
  const native = raxFacade.mcp.native.serve({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      serverName: "deepmind-inline-mcp"
    }
  });

  assert.deepEqual(direct, native);
});

test("facade mcp.native.prepare returns an ADK toolset-style payload for deepmind agent carrier", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    layer: "agent",
    input: {
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp",
        headers: {
          authorization: "Bearer test"
        }
      }
    }
  });

  assert.equal(plan.carrierKind, "provider-native");
  assert.equal(plan.builderId, "deepmind.agent.google-adk-mcp-runtime");
  assert.equal(plan.loweringMode, "provider-native-agent");
  assert.equal(plan.supported, true);
  assert.equal(plan.sdkPackageName, "@google/adk");
  assert.equal(plan.entrypoint, "McpToolset");
  assert.equal(
    ((plan.payload as { toolset?: { kind?: string } } | undefined)?.toolset?.kind),
    "google-adk-mcp-toolset"
  );
  assert.equal(
    ((plan.payload as { toolset?: { connectionParams?: { connectionType?: string } } } | undefined)?.toolset?.connectionParams?.connectionType),
    "streamable-http"
  );
});

test("facade mcp.native.prepare returns a Gemini model-side MCP bridge payload for deepmind api carrier", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const plan = raxFacade.mcp.native.prepare({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    layer: "api",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  assert.equal(plan.supported, true);
  assert.equal(plan.builderId, "deepmind.api.gemini-api-mcp");
  assert.equal(plan.sdkPackageName, "@google/genai");
  assert.equal(plan.entrypoint, "mcpToTool");
  assert.ok(Array.isArray(plan.constraintSnapshot.supportedModelHints));
  assert.ok(plan.constraintSnapshot.supportedModelHints?.includes("gemini-2.5-pro"));
  assert.equal(
    ((plan.payload as { carrier?: { shape?: string } } | undefined)?.carrier?.shape),
    "model-side-tool-bridge"
  );
  assert.equal(
    ((plan.payload as { mcpBridge?: { transportKind?: string } } | undefined)?.mcpBridge?.transportKind),
    "stdio"
  );
});

test("facade mcp.connect rejects explicit provider-native strategy until native execution is implemented", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  await assert.rejects(
    () =>
      raxFacade.mcp.connect({
        provider: "openai",
        model: "gpt-5",
        layer: "agent",
        input: {
          strategy: "provider-native",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest", "--help"]
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_native_execution_unimplemented");
      return true;
    }
  );
});

test("facade mcp.use rejects explicit provider-native strategy until native execution is implemented", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  await assert.rejects(
    () =>
      raxFacade.mcp.use({
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        layer: "agent",
        input: {
          strategy: "provider-native",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest", "--help"]
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_native_execution_unimplemented");
      return true;
    }
  );
});

test("facade mcp.native.build returns a PreparedInvocation for supported native plans", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const invocation = raxFacade.mcp.native.build({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    input: {
      connectionId: "openai-native-build",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  assert.equal(invocation.key, "mcp.connect");
  assert.equal(invocation.adapterId, "mcp.native.openai.api.openai-api-mcp");
  assert.equal(invocation.variant, "provider-native");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.responses.create");
  assert.equal(
    ((invocation.payload as { carrier?: { shape?: string } } | undefined)?.carrier?.shape),
    "responses-remote-mcp-tool"
  );
});

test("facade mcp.native.build returns an Anthropic API connector invocation", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const invocation = raxFacade.mcp.native.build({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "api",
    input: {
      connectionId: "anthropic-native-build",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  assert.equal(invocation.adapterId, "mcp.native.anthropic.api.anthropic-api-mcp-connector");
  assert.equal(invocation.variant, "provider-native");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.messages.create");
  assert.equal(
    (((invocation.payload as { tools?: Array<{ type?: string }> } | undefined)?.tools?.[0])?.type),
    "mcp_toolset"
  );
});

test("facade mcp.native.build rejects openai agent streamable-http until native hosted execute lands", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  assert.throws(
    () =>
      raxFacade.mcp.native.build({
        provider: "openai",
        model: "gpt-5",
        layer: "agent",
        input: {
          transport: {
            kind: "streamable-http",
            url: "https://example.com/mcp"
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_native_build_unsupported");
      assert.match(error.message, /streamable-http/u);
      return true;
    }
  );
});

test("facade mcp.native.build returns a DeepMind ADK runtime invocation", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  const invocation = raxFacade.mcp.native.build({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    layer: "agent",
    input: {
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  assert.equal(invocation.adapterId, "mcp.native.deepmind.agent.google-adk-mcp-runtime");
  assert.equal(invocation.sdk.packageName, "@google/adk");
  assert.equal(invocation.sdk.entrypoint, "McpToolset");
  assert.equal(
    ((invocation.payload as { toolset?: { kind?: string } } | undefined)?.toolset?.kind),
    "google-adk-mcp-toolset"
  );
});

test("facade mcp.native.build rejects unsupported native plans", () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const raxFacade = createRaxFacade(router, undefined, runtime);

  assert.throws(
    () =>
      raxFacade.mcp.native.build({
        provider: "openai",
        model: "gpt-5",
        layer: "api",
        input: {
          transport: {
            kind: "in-memory",
            transport: {} as never
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_native_build_unsupported");
      return true;
    }
  );
});

test("facade mcp.native.execute delegates to the injected native runtime", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const seen: Array<PreparedInvocation<Record<string, unknown>>> = [];
  const raxFacade = createRaxFacade(
    router,
    undefined,
    runtime,
    undefined,
    undefined,
    {
      executePreparedInvocation: async (invocation) => {
        seen.push(invocation);
        return { ok: true };
      }
    }
  );

  const invocation = raxFacade.mcp.native.build({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    input: {
      connectionId: "openai-native-build",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  const result = await raxFacade.mcp.native.execute(invocation);
  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.adapterId, invocation.adapterId);
});

test("facade mcp.native.composeAndExecute composes OpenAI invocations before delegating", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const seen: Array<PreparedInvocation<Record<string, unknown>>> = [];
  const raxFacade = createRaxFacade(
    router,
    undefined,
    runtime,
    undefined,
    undefined,
    {
      executePreparedInvocation: async (invocation) => {
        seen.push(invocation);
        return { ok: true };
      }
    }
  );

  const baseInvocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    input: {
      input: "hello from rax"
    }
  });

  const nativeInvocation = raxFacade.mcp.native.build({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    input: {
      connectionId: "openai-compose-exec",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  const result = await raxFacade.mcp.native.composeAndExecute(
    baseInvocation as never,
    nativeInvocation
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.provider, "openai");
  assert.equal(
    ((seen[0]?.payload as { params?: { tools?: Array<{ type?: string }> } } | undefined)?.params?.tools?.[0]?.type),
    "mcp"
  );
});

test("facade mcp.native.composeAndExecute composes Anthropic agent-native invocations before delegating", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const seen: Array<PreparedInvocation<Record<string, unknown>>> = [];
  const raxFacade = createRaxFacade(
    router,
    undefined,
    runtime,
    undefined,
    undefined,
    {
      executePreparedInvocation: async (invocation) => {
        seen.push(invocation);
        return { ok: true };
      }
    }
  );

  const baseInvocation = rax.generate.create({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      maxTokens: 64,
      messages: [{ role: "user", content: "hello from rax" }]
    }
  });

  const nativeInvocation = raxFacade.mcp.native.build({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "agent",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  const result = await raxFacade.mcp.native.composeAndExecute(
    baseInvocation as never,
    nativeInvocation
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.sdk.packageName, "@anthropic-ai/claude-agent-sdk");
  assert.equal(seen[0]?.sdk.entrypoint, "query");
  assert.equal(
    (seen[0]?.payload as { prompt?: string } | undefined)?.prompt,
    "hello from rax"
  );
});

test("facade mcp.native.composeAndExecute composes DeepMind agent-native invocations before delegating", async () => {
  const runtime = new McpRuntime();
  const router = new CapabilityRouter([]);
  const seen: Array<PreparedInvocation<Record<string, unknown>>> = [];
  const raxFacade = createRaxFacade(
    router,
    undefined,
    runtime,
    undefined,
    undefined,
    {
      executePreparedInvocation: async (invocation) => {
        seen.push(invocation);
        return { ok: true };
      }
    }
  );

  const baseInvocation = rax.generate.create({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      contents: "hello from rax"
    }
  });

  const nativeInvocation = raxFacade.mcp.native.build({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    layer: "agent",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  const result = await raxFacade.mcp.native.composeAndExecute(
    baseInvocation as never,
    nativeInvocation
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.sdk.packageName, "@google/adk");
  assert.equal(seen[0]?.sdk.entrypoint, "InMemoryRunner.runEphemeral");
  assert.equal(
    (seen[0]?.payload as { prompt?: string } | undefined)?.prompt,
    "hello from rax"
  );
});
