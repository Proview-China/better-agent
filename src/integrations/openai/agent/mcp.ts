import type {
  McpProviderShell,
  McpTransportConfig,
  OpenAIAgentNativeMcpPreparePayload
} from "../../../rax/mcp-types.js";

export const OPENAI_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "openai-mcp-agent-shell",
  provider: "openai",
  layer: "agent",
  officialCarrier: "openai-agents-mcp",
  carrierKind: "shared-runtime",
  loweringMode: "shared-runtime",
  isDefault: true,
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  nativeSupportedTransports: ["stdio"],
  nativeSupportsResources: false,
  nativeSupportsPrompts: false,
  nativeSupportsServe: false,
  supportsServe: false,
  supportsResources: false,
  supportsPrompts: false,
  notes: [
    "OpenAI agent MCP is modeled as the OpenAI Agents/runtime carrier in rax.",
    "This shell is the default OpenAI MCP route when upper layers ask for runtime-side orchestration.",
    "It remains tool-first; resources and prompts are not claimed here as first-class OpenAI agent carrier surface.",
    "Shared MCP runtime still handles the actual client connection lifecycle.",
    "Remote hosted MCP shapes stay out of the current native execute matrix until rax wires a truthful hosted execution path."
  ]
};

export function buildOpenAIAgentNativeMcpPayload(
  transport: McpTransportConfig
): {
  sdkPackageName: "@openai/agents";
  entrypoint: "MCPServerStdio" | "hostedMcpTool";
  payload: OpenAIAgentNativeMcpPreparePayload;
} {
  if (transport.kind === "stdio") {
    return {
      sdkPackageName: "@openai/agents",
      entrypoint: "MCPServerStdio",
      payload: {
        carrier: {
          type: "openai-agents-mcp",
          shape: "agent-local-stdio"
        },
        toolsOnly: true,
        mcpServer: {
          transport: "stdio",
          command: transport.command,
          args: transport.args,
          env: transport.env,
          cwd: transport.cwd
        }
      }
    };
  }

  return {
    sdkPackageName: "@openai/agents",
    entrypoint: "hostedMcpTool",
    payload: {
      carrier: {
        type: "openai-agents-mcp",
        shape: transport.kind === "streamable-http"
          ? "agent-remote-hosted"
          : "agent-runtime-fixture"
      },
      toolsOnly: true,
      mcpServer: transport.kind === "streamable-http"
        ? {
            transport: "streamable-http",
            url: transport.url,
            headers: transport.headers
          }
        : {
            transport: "in-memory-fixture"
          }
    }
  };
}
