import Anthropic from "@anthropic-ai/sdk";
import {
  ApigeeLlm,
  Gemini as DeepMindGemini,
  InMemoryRunner,
  isFinalResponse,
  LlmAgent,
  MCPToolset,
  stringifyContent
} from "@google/adk";
import { query as anthropicAgentQuery } from "@anthropic-ai/claude-agent-sdk";
import {
  Agent as OpenAIAgent,
  MCPServerStdio as OpenAIMCPServerStdio,
  OpenAIProvider,
  Runner as OpenAIRunner
} from "@openai/agents";

import type { PreparedInvocation } from "./contracts.js";
import { RaxRoutingError } from "./errors.js";
import { createOpenAIClient, loadLiveProviderConfig } from "./live-config.js";
import { refreshOpenAIOAuthIfNeeded } from "../raxcode-openai-auth.js";

async function consumeAnthropicAgentQuery(
  session: ReturnType<typeof anthropicAgentQuery>
): Promise<unknown> {
  let lastAssistantMessage: unknown;
  let resultError: string | undefined;

  try {
    for await (const message of session) {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type?: string }).type === "assistant"
      ) {
        lastAssistantMessage = (message as { message?: unknown }).message;
        continue;
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type?: string }).type === "result"
      ) {
        const typedMessage = message as {
          is_error?: boolean;
          result?: unknown;
        };
        if (typedMessage.is_error) {
          resultError = typeof typedMessage.result === "string"
            ? typedMessage.result
            : "Anthropic agent runtime reported an error result.";
        }
      }
    }
  } catch (error) {
    if (resultError) {
      throw new RaxRoutingError("mcp_native_execute_blocked", resultError);
    }
    throw error;
  } finally {
    session.close();
  }

  if (resultError) {
    throw new RaxRoutingError("mcp_native_execute_blocked", resultError);
  }

  if (lastAssistantMessage === undefined) {
    throw new RaxRoutingError(
      "mcp_native_execute_unsupported",
      "Anthropic agent-native MCP execution finished without producing a final assistant message."
    );
  }

  return lastAssistantMessage;
}

function isLikelyOfficialDeepMindBaseUrl(baseURL: string): boolean {
  return /googleapis\.com|generativelanguage\.googleapis\.com/iu.test(baseURL);
}

function buildDeepMindAdkModel(config: ReturnType<typeof loadLiveProviderConfig>["deepmind"], model: string) {
  if (isLikelyOfficialDeepMindBaseUrl(config.baseURL)) {
    return new DeepMindGemini({
      model,
      apiKey: config.apiKey
    });
  }

  return new ApigeeLlm({
    model: model.startsWith("apigee/") ? model : `apigee/gemini/v1beta/${model}`,
    proxyUrl: config.baseURL,
    apiKey: config.apiKey
  });
}

function normalizeDeepMindToolsetConnectionParams(toolset: unknown): ConstructorParameters<typeof MCPToolset>[0] {
  const typedToolset = toolset as {
    connectionParams?: {
      connectionType?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      url?: string;
      headers?: Record<string, string>;
    };
  };

  const connectionParams = typedToolset.connectionParams;
  if (connectionParams?.connectionType === "stdio") {
    return {
      type: "StdioConnectionParams",
      serverParams: {
        command: connectionParams.command ?? "npx",
        args: connectionParams.args,
        env: connectionParams.env,
        cwd: connectionParams.cwd
      }
    };
  }

  if (connectionParams?.connectionType === "streamable-http") {
    return {
      type: "StreamableHTTPConnectionParams",
      url: connectionParams.url ?? "",
      transportOptions: {
        requestInit: {
          headers: connectionParams.headers
        }
      }
    };
  }

  throw new RaxRoutingError(
    "mcp_native_execute_unsupported",
    `DeepMind agent-native MCP execution does not support connection type ${String(connectionParams?.connectionType)}.`
  );
}

export interface McpNativeRuntimeLike {
  executePreparedInvocation(
    invocation: PreparedInvocation<Record<string, unknown>>
  ): Promise<unknown>;
}

export interface McpNativeRuntimeOptions {
  openaiExecute?: (
    invocation: PreparedInvocation<Record<string, unknown>>
  ) => Promise<unknown>;
  anthropicExecute?: (
    invocation: PreparedInvocation<Record<string, unknown>>
  ) => Promise<unknown>;
  deepmindExecute?: (
    invocation: PreparedInvocation<Record<string, unknown>>
  ) => Promise<unknown>;
}

export class McpNativeRuntime implements McpNativeRuntimeLike {
  readonly #openaiExecute?: McpNativeRuntimeOptions["openaiExecute"];
  readonly #anthropicExecute?: McpNativeRuntimeOptions["anthropicExecute"];
  readonly #deepmindExecute?: McpNativeRuntimeOptions["deepmindExecute"];

  constructor(options: McpNativeRuntimeOptions = {}) {
    this.#openaiExecute = options.openaiExecute;
    this.#anthropicExecute = options.anthropicExecute;
    this.#deepmindExecute = options.deepmindExecute;
  }

  async executePreparedInvocation(
    invocation: PreparedInvocation<Record<string, unknown>>
  ): Promise<unknown> {
    switch (invocation.provider) {
      case "openai":
        return this.#executeOpenAI(invocation);
      case "anthropic":
        return this.#executeAnthropic(invocation);
      case "deepmind":
        return this.#executeDeepMind(invocation);
    }
  }

  async #executeOpenAI(
    invocation: PreparedInvocation<Record<string, unknown>>
  ): Promise<unknown> {
    if (this.#openaiExecute) {
      return this.#openaiExecute(invocation);
    }

    if (invocation.sdk.packageName === "@openai/agents") {
      const payload = invocation.payload as {
        prompt?: string;
        instructions?: string;
        mcpServer?: {
          transport?: string;
          command?: string;
          args?: string[];
          env?: Record<string, string>;
          cwd?: string;
        };
      };

      if (typeof payload.prompt !== "string" || payload.mcpServer?.transport === undefined) {
        throw new RaxRoutingError(
          "mcp_native_execute_unsupported",
          "OpenAI agent-native MCP execution expects a composed run payload with prompt and mcpServer."
        );
      }

      if (payload.mcpServer.transport !== "stdio") {
        throw new RaxRoutingError(
          "mcp_native_execute_unsupported",
          `OpenAI agent-native MCP execution currently only supports stdio transport, received ${payload.mcpServer.transport}.`
        );
      }

      await refreshOpenAIOAuthIfNeeded();
      const config = loadLiveProviderConfig().openai;
      const client = createOpenAIClient(config);
      const provider = new OpenAIProvider({
        openAIClient: client as any,
        useResponses: true
      });
      const runner = new OpenAIRunner({
        modelProvider: provider,
        tracingDisabled: true
      });
      const server = new OpenAIMCPServerStdio({
        command: payload.mcpServer.command ?? "npx",
        args: payload.mcpServer.args,
        env: payload.mcpServer.env,
        cwd: payload.mcpServer.cwd,
        name: "praxis"
      });

      await server.connect();
      try {
        const agent = new OpenAIAgent({
          name: "Praxis MCP Native",
          instructions: payload.instructions ?? "Use the MCP tools to complete the task.",
          model: invocation.model,
          mcpServers: [server]
        });

        return await runner.run(agent, payload.prompt, {
          maxTurns: 8
        });
      } finally {
        await Promise.allSettled([
          server.close(),
          provider.close()
        ]);
      }
    }

    const payload = invocation.payload as {
      surface?: string;
      params?: Record<string, unknown>;
    };
    if (payload.surface !== "responses" || payload.params === undefined) {
      throw new RaxRoutingError(
        "mcp_native_execute_unsupported",
        "OpenAI native MCP execution expects a Responses prepared invocation with params."
      );
    }

    await refreshOpenAIOAuthIfNeeded();
    const config = loadLiveProviderConfig().openai;
    const client = createOpenAIClient(config);

    return client.responses.create(payload.params as never);
  }

  async #executeAnthropic(
    invocation: PreparedInvocation<Record<string, unknown>>
  ): Promise<unknown> {
    if (this.#anthropicExecute) {
      return this.#anthropicExecute(invocation);
    }

    if (invocation.sdk.packageName === "@anthropic-ai/claude-agent-sdk") {
      const payload = invocation.payload as {
        mcpServers?: Record<string, unknown>;
        prompt?: string;
        system?: string;
      };

      if (typeof payload.prompt !== "string" || payload.mcpServers === undefined) {
        throw new RaxRoutingError(
          "mcp_native_execute_unsupported",
          "Anthropic agent-native MCP execution expects a query payload with prompt and mcpServers."
        );
      }

      const session = anthropicAgentQuery({
        prompt: payload.prompt,
        options: {
          model: invocation.model,
          mcpServers: payload.mcpServers as never,
          systemPrompt: payload.system,
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: loadLiveProviderConfig().anthropic.apiKey,
            ANTHROPIC_BASE_URL: loadLiveProviderConfig().anthropic.baseURL
          },
          canUseTool: async (_toolName, _input, options) => ({
            behavior: "allow",
            toolUseID: options.toolUseID
          }),
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true
        }
      });

      return consumeAnthropicAgentQuery(session);
    }

    if (invocation.sdk.entrypoint !== "client.messages.create") {
      throw new RaxRoutingError(
        "mcp_native_execute_unsupported",
        `Anthropic native MCP execution currently only supports Messages API invocations, received ${invocation.sdk.entrypoint}.`
      );
    }

    const payload = invocation.payload as Record<string, unknown>;
    const betas = Array.isArray(payload.betas)
      ? [...payload.betas, "mcp-client-2025-11-20"]
      : ["mcp-client-2025-11-20"];

    const config = loadLiveProviderConfig().anthropic;
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });

    return client.beta.messages.create({
      ...payload,
      betas
    } as never);
  }

  async #executeDeepMind(
    invocation: PreparedInvocation<Record<string, unknown>>
  ): Promise<unknown> {
    if (this.#deepmindExecute) {
      return this.#deepmindExecute(invocation);
    }

    if (invocation.sdk.packageName === "@google/adk") {
      const payload = invocation.payload as {
        prompt?: string;
        systemInstruction?: string;
        toolset?: unknown;
      };

      if (typeof payload.prompt !== "string" || payload.toolset === undefined) {
        throw new RaxRoutingError(
          "mcp_native_execute_unsupported",
          "DeepMind agent-native MCP execution expects a composed runtime payload with prompt and toolset."
        );
      }

      const config = loadLiveProviderConfig().deepmind;
      const toolset = new MCPToolset(normalizeDeepMindToolsetConnectionParams(payload.toolset));
      const model = buildDeepMindAdkModel(config, invocation.model);
      const agent = new LlmAgent({
        name: "PraxisMcpNative",
        model,
        instruction:
          payload.systemInstruction ??
          "Use the available MCP tools when needed and return the final answer directly.",
        tools: [toolset]
      });
      const runner = new InMemoryRunner({
        agent,
        appName: "PraxisDeepMindMcpNative"
      });

      let finalText = "";

      try {
        for await (const event of runner.runEphemeral({
          userId: "praxis-mcp-native-user",
          newMessage: {
            role: "user",
            parts: [{ text: payload.prompt }]
          }
        })) {
          if (isFinalResponse(event)) {
            finalText = stringifyContent(event).trim();
            return {
              finalOutput: finalText,
              finalEvent: event
            };
          }
        }
      } finally {
        await toolset.close().catch(() => undefined);
      }

      throw new RaxRoutingError(
        "mcp_native_execute_unsupported",
        "DeepMind agent-native MCP execution finished without a final response event."
      );
    }

    throw new RaxRoutingError(
      "mcp_native_execute_unsupported",
      `DeepMind/Gemini native MCP execution is not implemented for ${invocation.adapterId}; use runtime/client-side MCP bridging instead of static execution.`
    );
  }
}
