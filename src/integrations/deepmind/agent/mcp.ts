import type {
  DeepMindAgentNativeMcpPreparePayload,
  McpProviderShell,
  McpTransportConfig
} from "../../../rax/mcp-types.js";

export const DEEPMIND_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "deepmind-mcp-agent-shell",
  provider: "deepmind",
  layer: "agent",
  officialCarrier: "google-adk-mcp-runtime",
  carrierKind: "shared-runtime",
  loweringMode: "shared-runtime",
  isDefault: true,
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  nativeSupportedTransports: ["stdio", "streamable-http"],
  nativeSupportsResources: false,
  nativeSupportsPrompts: false,
  nativeSupportsServe: false,
  supportsServe: false,
  supportsResources: false,
  supportsPrompts: false,
  notes: [
    "DeepMind agent-side MCP is modeled as the Google ADK/runtime carrier in rax.",
    "This shell is the place to hang ADK-style MCP runtime semantics, not Gemini API model-side MCP tool conversion.",
    "It stays tools-first for now: resources/prompts are not claimed as a first-class ADK carrier surface until rax grows provider-specific handling beyond the shared client runtime core.",
    "Shared MCP runtime still owns the underlying client connection lifecycle; this shell only states how the DeepMind route should be interpreted at the control-plane level."
  ]
};

export function buildDeepMindAgentNativeMcpPayload(
  transport: McpTransportConfig
): {
  sdkPackageName: "@google/adk";
  entrypoint: "McpToolset";
  payload: DeepMindAgentNativeMcpPreparePayload;
} {
  const connectionParams = (() => {
    switch (transport.kind) {
      case "stdio":
        return {
          connectionType: "stdio",
          command: transport.command,
          args: transport.args,
          env: transport.env,
          cwd: transport.cwd
        };
      case "streamable-http":
        return {
          connectionType: "streamable-http",
          url: transport.url,
          headers: transport.headers
        };
      case "in-memory":
        return {
          connectionType: "in-memory-fixture"
        };
    }
  })();

  return {
    sdkPackageName: "@google/adk",
    entrypoint: "McpToolset",
    payload: {
      carrier: {
        type: "google-adk-mcp-runtime",
        runtime: "adk-agent-runtime"
      },
      toolset: {
        kind: "google-adk-mcp-toolset",
        toolsetFactory: "McpToolset",
        connectionParams
      },
      surface: {
        tools: {
          supported: true,
          mode: "native"
        },
        resources: {
          supported: false
        },
        prompts: {
          supported: false
        },
        serve: {
          supported: false
        }
      }
    }
  };
}
