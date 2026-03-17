import type {
  AnthropicAgentNativeMcpPreparePayload,
  McpProviderShell,
  McpTransportConfig
} from "../../../rax/mcp-types.js";

export const ANTHROPIC_AGENT_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "anthropic-mcp-agent-shell",
  provider: "anthropic",
  layer: "agent",
  officialCarrier: "anthropic-agent-runtime-mcp",
  carrierKind: "shared-runtime",
  loweringMode: "shared-runtime",
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  nativeSupportedTransports: ["stdio", "streamable-http"],
  nativeSupportsResources: true,
  nativeSupportsPrompts: true,
  nativeSupportsServe: false,
  supportsServe: false,
  supportsResources: true,
  supportsPrompts: true,
  notes: [
    "Anthropic agent-side MCP is modeled as the Claude Agent SDK / Claude Code runtime carrier in rax.",
    "This agent shell is the place for richer MCP surfaces, including local stdio connectivity plus tools/resources/prompts for runtime-mediated use.",
    "Shared MCP runtime still handles the underlying client connection lifecycle, while this shell defines the richer agent-facing capability posture."
  ]
};

export function buildAnthropicAgentNativeMcpPayload(
  transport: McpTransportConfig
): {
  sdkPackageName: "@anthropic-ai/claude-agent-sdk";
  entrypoint: "mcpServers";
  payload: AnthropicAgentNativeMcpPreparePayload;
} {
  const serverConfig = (() => {
    switch (transport.kind) {
      case "stdio":
        return {
          type: "stdio",
          command: transport.command,
          args: transport.args,
          env: transport.env,
          cwd: transport.cwd
        };
      case "streamable-http":
        return {
          type: "http",
          url: transport.url,
          headers: transport.headers
        };
      case "in-memory":
        return {
          type: "in-memory-fixture"
        };
    }
  })();

  return {
    sdkPackageName: "@anthropic-ai/claude-agent-sdk",
    entrypoint: "mcpServers",
    payload: {
      carrier: {
        type: "anthropic-agent-runtime-mcp",
        runtime: "claude-agent-code",
        locality: transport.kind === "stdio" ? "local-preferred" : "remote-capable"
      },
      transport: {
        kind: transport.kind
      },
      mcpServers: {
        praxis: serverConfig
      },
      surface: {
        tools: {
          supported: true,
          mode: "native"
        },
        resources: {
          supported: true,
          mode: "runtime-mediated"
        },
        prompts: {
          supported: true,
          mode: "runtime-mediated"
        },
        serve: {
          supported: false
        }
      }
    }
  };
}
