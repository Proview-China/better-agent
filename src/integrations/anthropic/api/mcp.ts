import type {
  AnthropicApiNativeMcpPreparePayload,
  McpProviderShell,
  McpTransportConfig
} from "../../../rax/mcp-types.js";

export const ANTHROPIC_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "anthropic-mcp-api-shell",
  provider: "anthropic",
  layer: "api",
  officialCarrier: "anthropic-api-mcp-connector",
  carrierKind: "shared-runtime",
  loweringMode: "shared-runtime",
  isDefault: true,
  supportedTransports: ["streamable-http", "in-memory"],
  nativeSupportedTransports: ["streamable-http"],
  nativeSupportsResources: false,
  nativeSupportsPrompts: false,
  nativeSupportsServe: false,
  supportsServe: false,
  supportsResources: false,
  supportsPrompts: false,
  notes: [
    "Anthropic API MCP is modeled as the official remote MCP connector surface in rax.",
    "This API shell is remote-first and tool-first: treat it as connector wiring for MCP tool use, not as a richer Claude runtime carrier.",
    "Resources/prompts are intentionally not claimed on this shell; in-memory transport remains enabled only for local tests and internal runtime fixtures."
  ]
};

export function buildAnthropicApiNativeMcpPayload(
  transport: McpTransportConfig,
  serverName: string
): {
  sdkPackageName: "@anthropic-ai/sdk";
  entrypoint: "client.messages.create";
  payload: AnthropicApiNativeMcpPreparePayload;
} | undefined {
  if (transport.kind !== "streamable-http") {
    return undefined;
  }

  return {
    sdkPackageName: "@anthropic-ai/sdk",
    entrypoint: "client.messages.create",
    payload: {
      carrier: {
        type: "anthropic-api-mcp-connector",
        shape: "messages-mcp-connector"
      },
      toolsOnly: true,
      mcp_servers: [
        {
          type: "url",
          name: serverName,
          url: transport.url
        }
      ],
      tools: [
        {
          type: "mcp_toolset",
          mcp_server_name: serverName
        }
      ]
    }
  };
}
