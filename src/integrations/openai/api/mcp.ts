import type {
  McpProviderShell,
  McpTransportConfig,
  OpenAIApiNativeMcpPreparePayload
} from "../../../rax/mcp-types.js";

export const OPENAI_API_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "openai-mcp-api-shell",
  provider: "openai",
  layer: "api",
  officialCarrier: "openai-api-mcp",
  carrierKind: "shared-runtime",
  loweringMode: "shared-runtime",
  supportedTransports: ["streamable-http", "in-memory"],
  nativeSupportedTransports: ["streamable-http"],
  nativeSupportsResources: false,
  nativeSupportsPrompts: false,
  nativeSupportsServe: false,
  supportsServe: false,
  supportsResources: false,
  supportsPrompts: false,
  notes: [
    "OpenAI API MCP is modeled as the API-side carrier in rax.",
    "This shell is tool-first and represents API-facing MCP attachment rather than an agent-runtime loop.",
    "Resources and prompts stay disabled here so rax does not overclaim the OpenAI API carrier surface.",
    "in-memory transport remains enabled only for local tests and internal runtime fixtures."
  ]
};

export function buildOpenAIApiNativeMcpPayload(
  transport: McpTransportConfig,
  serverLabel: string
): {
  sdkPackageName: "openai";
  entrypoint: "client.responses.create";
  payload: OpenAIApiNativeMcpPreparePayload;
} | undefined {
  if (transport.kind !== "streamable-http") {
    return undefined;
  }

  return {
    sdkPackageName: "openai",
    entrypoint: "client.responses.create",
    payload: {
      carrier: {
        type: "openai-api-mcp",
        shape: "responses-remote-mcp-tool"
      },
      toolsOnly: true,
      tools: [
        {
          type: "mcp",
          server_label: serverLabel,
          server_url: transport.url
        }
      ]
    }
  };
}
