import type { PreparedInvocation } from "./contracts.js";
import { RaxRoutingError } from "./errors.js";

function normalizeNativeInvocations(
  nativeInvocations: PreparedInvocation<Record<string, unknown>> | Array<PreparedInvocation<Record<string, unknown>>>
): Array<PreparedInvocation<Record<string, unknown>>> {
  return Array.isArray(nativeInvocations) ? nativeInvocations : [nativeInvocations];
}

function assertMatchingProvider(
  base: PreparedInvocation<Record<string, unknown>>,
  nativeInvocations: Array<PreparedInvocation<Record<string, unknown>>>
): void {
  for (const nativeInvocation of nativeInvocations) {
    if (nativeInvocation.provider !== base.provider) {
      throw new RaxRoutingError(
        "mcp_native_compose_mismatch",
        `Cannot compose ${nativeInvocation.provider} native MCP into ${base.provider} invocation.`
      );
    }
  }
}

function extractTextFromOpenAIResponseInput(input: unknown): string[] {
  if (typeof input === "string") {
    return [input];
  }

  if (!Array.isArray(input)) {
    return [];
  }

  const segments: string[] = [];

  for (const item of input) {
    if (typeof item === "string") {
      segments.push(item);
      continue;
    }

    if (typeof item !== "object" || item === null) {
      continue;
    }

    const typedItem = item as {
      role?: string;
      type?: string;
      content?: unknown;
      text?: string;
    };

    if (typedItem.role === "user" || typedItem.type === "message") {
      segments.push(...extractTextFromOpenAIResponseInput(typedItem.content));
      continue;
    }

    if (
      (typedItem.type === "input_text" || typedItem.type === "output_text" || typedItem.type === "text") &&
      typeof typedItem.text === "string"
    ) {
      segments.push(typedItem.text);
      continue;
    }

    if (Array.isArray(typedItem.content)) {
      segments.push(...extractTextFromOpenAIResponseInput(typedItem.content));
    }
  }

  return segments;
}

function extractTextFromGeminiContents(contents: unknown): string[] {
  if (typeof contents === "string") {
    return [contents];
  }

  if (Array.isArray(contents)) {
    return contents.flatMap((item) => extractTextFromGeminiContents(item));
  }

  if (typeof contents !== "object" || contents === null) {
    return [];
  }

  const typedContents = contents as {
    text?: string;
    parts?: unknown[];
    contents?: unknown;
  };

  if (typeof typedContents.text === "string") {
    return [typedContents.text];
  }

  if (Array.isArray(typedContents.parts)) {
    return typedContents.parts.flatMap((part) => extractTextFromGeminiContents(part));
  }

  if (typedContents.contents !== undefined) {
    return extractTextFromGeminiContents(typedContents.contents);
  }

  return [];
}

function composeOpenAIInvocation(
  base: PreparedInvocation<Record<string, unknown>>,
  nativeInvocations: Array<PreparedInvocation<Record<string, unknown>>>
): PreparedInvocation<Record<string, unknown>> {
  const agentNative = nativeInvocations.find(
    (invocation) => invocation.sdk.packageName === "@openai/agents"
  );
  if (agentNative) {
    const payload = base.payload as {
      surface?: string;
      params?: {
        input?: unknown;
        instructions?: string;
      };
    };

    if (payload.surface !== "responses") {
      throw new RaxRoutingError(
        "mcp_native_compose_unsupported",
        "OpenAI agent-native compose currently only supports Responses-based prepared invocations."
      );
    }

    const prompt = extractTextFromOpenAIResponseInput(payload.params?.input)
      .join("\n")
      .trim();
    if (!prompt) {
      throw new RaxRoutingError(
        "mcp_native_compose_unsupported",
        "OpenAI agent-native compose currently requires a plain user text prompt."
      );
    }

    const nativePayload = agentNative.payload as Record<string, unknown>;
    return {
      key: base.key,
      provider: base.provider,
      model: base.model,
      layer: "agent",
      variant: "provider-native",
      adapterId: `${base.adapterId}+native-mcp-agent`,
      sdk: {
        packageName: "@openai/agents",
        entrypoint: "run",
        notes: "Composed into OpenAI Agents MCP invocation."
      },
      payload: {
        prompt,
        instructions: payload.params?.instructions,
        mcpServer: nativePayload.mcpServer,
        carrier: nativePayload.carrier,
        toolsOnly: nativePayload.toolsOnly ?? true
      }
    };
  }

  const payload = base.payload as {
    surface?: string;
    params: Record<string, unknown> & {
      tools?: unknown[];
    };
    notes?: string[];
  };

  if (payload.surface !== "responses") {
    throw new RaxRoutingError(
      "mcp_native_compose_unsupported",
      "OpenAI native MCP compose currently only supports Responses-based prepared invocations."
    );
  }

  const nativeTools = nativeInvocations.flatMap((invocation) => {
    const toolPayload = invocation.payload as {
      tools?: unknown[];
    };
    return toolPayload.tools ?? [];
  });

  return {
    ...base,
    payload: {
      ...payload,
      params: {
        ...payload.params,
        tools: [...(payload.params.tools ?? []), ...nativeTools]
      },
      notes: [
        ...(payload.notes ?? []),
        "Composed with native MCP tool attachments."
      ]
    }
  };
}

function composeAnthropicInvocation(
  base: PreparedInvocation<Record<string, unknown>>,
  nativeInvocations: Array<PreparedInvocation<Record<string, unknown>>>
): PreparedInvocation<Record<string, unknown>> {
  const agentNative = nativeInvocations.find(
    (invocation) => invocation.sdk.packageName === "@anthropic-ai/claude-agent-sdk"
  );
  if (agentNative) {
    const payload = base.payload as {
      messages?: Array<{
        role?: string;
        content?: string | Array<{ type?: string; text?: string }>;
      }>;
      system?: string;
    };

    const userPrompt = (payload.messages ?? [])
      .filter((message) => message.role === "user")
      .flatMap((message) => {
        if (typeof message.content === "string") {
          return [message.content];
        }
        if (Array.isArray(message.content)) {
          return message.content
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text ?? "");
        }
        return [];
      })
      .join("\n")
      .trim();

    if (!userPrompt) {
      throw new RaxRoutingError(
        "mcp_native_compose_unsupported",
        "Anthropic agent-native compose currently requires a plain user text prompt."
      );
    }

    const nativePayload = agentNative.payload as {
      mcpServers?: Record<string, unknown>;
      carrier?: unknown;
      surface?: unknown;
    };

    return {
      key: base.key,
      provider: base.provider,
      model: base.model,
      layer: "agent",
      variant: "provider-native",
      adapterId: `${base.adapterId}+native-mcp-agent`,
      sdk: {
        packageName: "@anthropic-ai/claude-agent-sdk",
        entrypoint: "query",
        notes: "Composed into Anthropic agent-runtime MCP invocation."
      },
      payload: {
        prompt: userPrompt,
        system: payload.system,
        mcpServers: nativePayload.mcpServers,
        carrier: nativePayload.carrier,
        surface: nativePayload.surface
      }
    };
  }

  const payload = base.payload as Record<string, unknown> & {
    mcp_servers?: unknown[];
    tools?: unknown[];
  };

  const nativeServers = nativeInvocations.flatMap((invocation) => {
    const nativePayload = invocation.payload as {
      mcp_servers?: unknown[];
    };
    return nativePayload.mcp_servers ?? [];
  });

  const nativeTools = nativeInvocations.flatMap((invocation) => {
    const nativePayload = invocation.payload as {
      tools?: unknown[];
    };
    return nativePayload.tools ?? [];
  });

  return {
    ...base,
    payload: {
      ...payload,
      mcp_servers: [...(payload.mcp_servers ?? []), ...nativeServers],
      tools: [...(payload.tools ?? []), ...nativeTools]
    }
  };
}

function composeDeepMindInvocation(
  base: PreparedInvocation<Record<string, unknown>>,
  nativeInvocations: Array<PreparedInvocation<Record<string, unknown>>>
): PreparedInvocation<Record<string, unknown>> {
  const agentNative = nativeInvocations.find(
    (invocation) => invocation.sdk.packageName === "@google/adk"
  );
  if (agentNative) {
    const payload = base.payload as {
      method?: string;
      params?: {
        contents?: unknown;
        config?: {
          systemInstruction?: unknown;
        };
      };
    };

    if (payload.method !== "ai.models.generateContent") {
      throw new RaxRoutingError(
        "mcp_native_compose_unsupported",
        "DeepMind agent-native compose currently only supports generateContent-based prepared invocations."
      );
    }

    const prompt = extractTextFromGeminiContents(payload.params?.contents)
      .join("\n")
      .trim();

    if (!prompt) {
      throw new RaxRoutingError(
        "mcp_native_compose_unsupported",
        "DeepMind agent-native compose currently requires a plain user text prompt."
      );
    }

    const systemInstruction =
      typeof payload.params?.config?.systemInstruction === "string"
        ? payload.params.config.systemInstruction
        : undefined;

    const nativePayload = agentNative.payload as {
      toolset?: unknown;
      carrier?: unknown;
      surface?: unknown;
    };

    return {
      key: base.key,
      provider: base.provider,
      model: base.model,
      layer: "agent",
      variant: "provider-native",
      adapterId: `${base.adapterId}+native-mcp-agent`,
      sdk: {
        packageName: "@google/adk",
        entrypoint: "InMemoryRunner.runEphemeral",
        notes: "Composed into Google ADK MCP runtime invocation."
      },
      payload: {
        prompt,
        systemInstruction,
        toolset: nativePayload.toolset,
        carrier: nativePayload.carrier,
        surface: nativePayload.surface
      }
    };
  }

  throw new RaxRoutingError(
    "mcp_native_compose_unsupported",
    "DeepMind/Gemini native MCP compose is not implemented as a static JSON merge in rax; use runtime/client-side mcpToTool semantics instead."
  );
}

export function composeNativeMcpInvocation(
  base: PreparedInvocation<Record<string, unknown>>,
  nativeInvocations: PreparedInvocation<Record<string, unknown>> | Array<PreparedInvocation<Record<string, unknown>>>
): PreparedInvocation<Record<string, unknown>> {
  const normalized = normalizeNativeInvocations(nativeInvocations);
  assertMatchingProvider(base, normalized);

  switch (base.provider) {
    case "openai":
      return composeOpenAIInvocation(base, normalized);
    case "anthropic":
      return composeAnthropicInvocation(base, normalized);
    case "deepmind":
      return composeDeepMindInvocation(base, normalized);
  }
}
