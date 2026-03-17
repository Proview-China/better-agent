import type {
  DeepMindApiNativeMcpPreparePayload,
  McpProviderShell,
  McpTransportConfig
} from "../../../rax/mcp-types.js";

export const DEEPMIND_API_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "deepmind-mcp-api-shell",
  provider: "deepmind",
  layer: "api",
  officialCarrier: "gemini-api-mcp",
  carrierKind: "shared-runtime",
  loweringMode: "shared-runtime",
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  nativeSupportedTransports: ["stdio", "streamable-http"],
  nativeSupportsResources: false,
  nativeSupportsPrompts: false,
  nativeSupportsServe: false,
  supportsServe: false,
  supportsResources: false,
  supportsPrompts: false,
  notes: [
    "Gemini API MCP is modeled as an API-side carrier in rax.",
    "This shell is tools-first: it represents Gemini MCP tool wiring and does not claim resources/prompts as a first-class Gemini API carrier surface.",
    "Actual remote MCP availability still depends on model and tool-combination constraints; compatibility profiles and runtime policy should narrow that matrix instead of assuming every Gemini route supports MCP equally.",
    "Stdio and in-memory remain listed because the shared MCP runtime can use them for local development and test fixtures, even when the most official hosted shape is remote MCP tooling."
  ]
};

export function buildDeepMindApiNativeMcpPayload(
  transport: McpTransportConfig
): {
  sdkPackageName: "@google/genai";
  entrypoint: "mcpToTool";
  payload: DeepMindApiNativeMcpPreparePayload;
} {
  return {
    sdkPackageName: "@google/genai",
    entrypoint: "mcpToTool",
    payload: {
      carrier: {
        type: "gemini-api-mcp",
        shape: "model-side-tool-bridge"
      },
      toolsOnly: true,
      mcpBridge: {
        transportKind: transport.kind,
        source: transport.kind === "stdio"
          ? {
              command: transport.command,
              args: transport.args,
              env: transport.env,
              cwd: transport.cwd
            }
          : transport.kind === "streamable-http"
            ? {
                url: transport.url,
                headers: transport.headers
              }
            : {
                transport: "in-memory-fixture"
              }
      }
    }
  };
}
