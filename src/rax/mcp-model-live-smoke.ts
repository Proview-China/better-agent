import Anthropic from "@anthropic-ai/sdk";
import { mcpTools } from "@anthropic-ai/sdk/helpers/beta/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GoogleGenAI, mcpToTool } from "@google/genai";
import type {
  FunctionTool,
  ResponseInputItem
} from "openai/resources/responses/responses";

import { createOpenAIClient, loadLiveProviderConfig } from "./live-config.js";
import { rax } from "./runtime.js";
import { refreshOpenAIOAuthIfNeeded } from "../raxcode-openai-auth.js";

interface SmokeResult {
  name: string;
  status: "pass" | "fail" | "blocked";
  details: string;
}

const PLAYWRIGHT_ARGS = [
  "-y",
  "@playwright/mcp@latest",
  "--headless",
  "--isolated",
  "--output-mode",
  "stdout",
  "--browser",
  "chrome"
];

const PROMPT =
  "Use the browser tools to open https://example.com and answer with only the page title.";

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((item) => {
      if (typeof item === "object" && item !== null && "text" in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === "string" ? [text] : [];
      }
      return [];
    })
    .join("\n");
}

async function runGptViaResponsesLoop(): Promise<SmokeResult> {
  await refreshOpenAIOAuthIfNeeded();
  const config = loadLiveProviderConfig();
  const modelCandidates = Array.from(new Set([config.openai.model, "gpt-5.4"]));
  const client = createOpenAIClient(config.openai);

  for (const model of modelCandidates) {
    const session = await rax.mcp.use({
      provider: "openai",
      model,
      input: {
        connectionId: `gpt-mcp-model-live-smoke-${model}`,
        transport: {
          kind: "stdio",
          command: "npx",
          args: PLAYWRIGHT_ARGS
        }
      }
    });

    try {
      const allTools = await session.tools();
      const tools: FunctionTool[] = allTools.tools
        .filter((tool) => ["browser_navigate", "browser_snapshot"].includes(tool.name))
        .map((tool) => ({
          type: "function" as const,
          name: tool.name,
          description: tool.description ?? "",
          strict: false,
          parameters:
            tool.inputSchema ?? {
              type: "object",
              properties: {},
              additionalProperties: false
            }
        }));

      const transcript: ResponseInputItem[] = [];
      const reasoning = config.openai.reasoningEffort
        ? ({
            effort: config.openai.reasoningEffort
          } as const)
        : undefined;

      for (let step = 0; step < 6; step += 1) {
        const response = await client.responses.create({
          model,
          reasoning,
          input:
            transcript.length === 0
              ? PROMPT
              : [{ role: "user", content: PROMPT }, ...transcript],
          tools
        } as never);

        const functionCalls = (response.output ?? []).filter(
          (item): item is {
            type: "function_call";
            call_id: string;
            name: string;
            arguments: string;
          } => item.type === "function_call"
        );

        if (functionCalls.length === 0) {
          const answer = (response.output_text ?? "").trim();
          return answer === "Example Domain"
            ? {
                name: "gpt:gmn:responses+mcp",
                status: "pass",
                details: `model ${model} final answer: ${answer}`
              }
            : {
                name: "gpt:gmn:responses+mcp",
                status: "fail",
                details: `model ${model} returned unexpected answer: ${answer || "<empty>"}`
              };
        }

        for (const call of functionCalls) {
          const result = await session.call({
            toolName: call.name,
            arguments: call.arguments ? JSON.parse(call.arguments) : {}
          });

          transcript.push({
            type: "function_call",
            call_id: call.call_id,
            name: call.name,
            arguments: call.arguments ?? "{}"
          } as ResponseInputItem);
          transcript.push({
            type: "function_call_output",
            call_id: call.call_id,
            output:
              extractTextContent(result.content) ||
              JSON.stringify(result.structuredContent ?? result.raw ?? {})
          } as ResponseInputItem);
        }
      }
    } catch {
      // Try the next known-good model candidate.
    } finally {
      await session.disconnect().catch(() => undefined);
    }
  }

  return {
    name: "gpt:gmn:responses+mcp",
    status: "fail",
    details: "all configured OpenAI model candidates failed; gmn should prefer gpt-5.4"
  };
}

async function runGeminiViaMcpTool(): Promise<SmokeResult> {
  const config = loadLiveProviderConfig();
  const client = new Client({ name: "gemini-mcp-smoke", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: PLAYWRIGHT_ARGS
  });
  const ai = new GoogleGenAI({
    apiKey: config.deepmind.apiKey,
    httpOptions: {
      baseUrl: config.deepmind.baseURL
    }
  });

  await client.connect(transport);

  const candidates = [config.deepmind.model, "gemini-2.5-flash", "gemini-2.5-pro"];
  try {
    let lastError: unknown;

    for (const model of candidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: PROMPT,
          config: {
            tools: [mcpToTool(client)]
          }
        });

        const answer = (response.text ?? "").trim();
        if (answer === "Example Domain") {
          return {
            name: "gemini:viewpro:mcpToTool",
            status: "pass",
            details: `model ${model} returned ${answer}`
          };
        }

        return {
          name: "gemini:viewpro:mcpToTool",
          status: "fail",
          details: `model ${model} returned unexpected answer: ${answer || "<empty>"}`
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      name: "gemini:viewpro:mcpToTool",
      status: "fail",
      details: lastError instanceof Error ? lastError.message : String(lastError)
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function probeAnthropicApiAvailability(): Promise<SmokeResult> {
  const config = loadLiveProviderConfig();
  const clients = [
    {
      label: "primary",
      client: new Anthropic({
        apiKey: config.anthropic.apiKey,
        baseURL: config.anthropic.baseURL
      }),
      models: [config.anthropic.model, "claude-opus-4-6-thinking", "claude-sonnet-4-6"]
    },
    ...(config.anthropicAlt
      ? [
          {
            label: "alt",
            client: new Anthropic({
              apiKey: config.anthropicAlt.apiKey,
              baseURL: config.anthropicAlt.baseURL
            }),
            models: [config.anthropicAlt.model, "claude-opus-4-6-thinking", "claude-sonnet-4-6"]
          }
        ]
      : [])
  ];

  const failures: string[] = [];

  for (const candidate of clients) {
    for (const model of candidate.models) {
      try {
        await candidate.client.messages.create({
          model,
          max_tokens: 16,
          messages: [{ role: "user", content: "Reply with OK." }]
        });
        return {
          name: "claude:api-upstream-probe",
          status: "pass",
          details: `${candidate.label} upstream accepted ${model}`
        };
      } catch (error) {
        failures.push(
          `${candidate.label}:${model}:${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return {
    name: "claude:api-upstream-probe",
    status: "blocked",
    details: failures.join(" | ")
  };
}

async function runClaudeViaApiMcp(): Promise<SmokeResult> {
  const config = loadLiveProviderConfig();
  const client = new Anthropic({
    apiKey: config.anthropic.apiKey,
    baseURL: config.anthropic.baseURL
  });
  const mcpClient = new Client({ name: "claude-api-mcp-smoke", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: PLAYWRIGHT_ARGS
  });

  await mcpClient.connect(transport);
  try {
    const { tools } = await mcpClient.listTools();
    const finalMessage = await client.beta.messages.toolRunner({
      model: "claude-opus-4-6-thinking",
      max_tokens: 128,
      messages: [{ role: "user", content: PROMPT }],
      tools: mcpTools(tools, mcpClient as never)
    });

    const answer = extractTextContent(finalMessage.content).replace(/\*/gu, "").trim();

    return answer === "Example Domain"
      ? {
          name: "claude:viewpro:toolRunner+mcp",
          status: "pass",
          details: `final answer: ${answer}`
        }
      : {
          name: "claude:viewpro:toolRunner+mcp",
          status: "fail",
          details: `unexpected final answer: ${answer || "<empty>"}`
        };
  } catch (error) {
    return {
      name: "claude:viewpro:toolRunner+mcp",
      status: "fail",
      details: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await mcpClient.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const results = [
    await runGptViaResponsesLoop(),
    await probeAnthropicApiAvailability(),
    await runClaudeViaApiMcp(),
    await runGeminiViaMcpTool()
  ];

  for (const result of results) {
    console.log(`[${result.status.toUpperCase()}] ${result.name}: ${result.details}`);
  }

  const failures = results.filter((result) => result.status === "fail");
  process.exit(failures.length > 0 ? 1 : 0);
}

await main();
