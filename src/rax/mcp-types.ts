import type { IOType } from "node:child_process";
import type { Stream } from "node:stream";

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ClientCapabilities, ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";

import type { ProviderId, SdkLayer } from "./types.js";

export type McpTransportKind = "stdio" | "streamable-http" | "in-memory";
export type McpCarrierKind = "shared-runtime" | "provider-native";
export type McpLoweringMode =
  | "shared-runtime"
  | "provider-native-api"
  | "provider-native-agent";

export interface McpStdioTransportConfig {
  kind: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  stderr?: IOType | Stream | number;
}

export interface McpStreamableHttpTransportConfig {
  kind: "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

export interface McpInMemoryTransportConfig {
  kind: "in-memory";
  transport: Transport;
}

export type McpTransportConfig =
  | McpStdioTransportConfig
  | McpStreamableHttpTransportConfig
  | McpInMemoryTransportConfig;

export interface McpConnectInput {
  connectionId?: string;
  transport: McpTransportConfig;
  strategy?: "auto" | "shared-runtime" | "provider-native";
  metadata?: Record<string, unknown>;
}

export interface McpListToolsInput {
  connectionId: string;
}

export interface McpListResourcesInput {
  connectionId: string;
}

export interface McpReadResourceInput {
  connectionId: string;
  uri: string;
}

export interface McpListPromptsInput {
  connectionId: string;
}

export interface McpGetPromptInput {
  connectionId: string;
  name: string;
  arguments?: Record<string, string>;
}

export interface McpCallInput {
  connectionId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  serverName?: string;
  qualifiedToolName?: string;
}

export interface McpServeToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  annotations?: Record<string, unknown>;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<unknown>;
}

export interface McpServeInput {
  serverName: string;
  serverVersion?: string;
  tools?: McpServeToolDefinition[];
}

export interface McpConnectionSummary {
  connectionId: string;
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  shellId: string;
  officialCarrier: string;
  carrierKind: McpCarrierKind;
  loweringMode: McpLoweringMode;
  transportKind: McpTransportKind;
  profileId?: string;
  serverCapabilities?: ServerCapabilities;
  serverVersion?: {
    name: string;
    version: string;
  };
  metadata?: Record<string, unknown>;
}

export interface McpToolSummary {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  raw?: unknown;
}

export interface McpResourceSummary {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: Record<string, unknown>;
  raw?: unknown;
}

export interface McpPromptSummary {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  raw?: unknown;
}

export interface McpListToolsResult {
  connectionId: string;
  tools: McpToolSummary[];
  raw?: unknown;
}

export interface McpListResourcesResult {
  connectionId: string;
  resources: McpResourceSummary[];
  raw?: unknown;
}

export interface McpReadResourceResult {
  connectionId: string;
  uri: string;
  contents: unknown[];
  raw?: unknown;
}

export interface McpListPromptsResult {
  connectionId: string;
  prompts: McpPromptSummary[];
  raw?: unknown;
}

export interface McpGetPromptResult {
  connectionId: string;
  name: string;
  messages: unknown[];
  raw?: unknown;
}

export interface McpCallResult {
  connectionId: string;
  toolName: string;
  serverName?: string;
  qualifiedToolName?: string;
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
  errorMessage?: string;
  raw?: unknown;
}

export interface McpServeResult {
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  officialCarrier: string;
  supported: boolean;
  sdk?: {
    packageName: string;
    entrypoint: string;
    notes?: string;
  };
  payload?: Record<string, unknown>;
  unsupportedReasons?: string[];
  notes: string[];
}

export type McpSessionCallInput = Omit<McpCallInput, "connectionId">;
export type McpSessionReadResourceInput = Omit<McpReadResourceInput, "connectionId">;
export type McpSessionGetPromptInput = Omit<McpGetPromptInput, "connectionId">;

export interface McpSessionHandle {
  connection: McpConnectionSummary;
  tools(): Promise<McpListToolsResult>;
  resources(): Promise<McpListResourcesResult>;
  read(input: McpSessionReadResourceInput): Promise<McpReadResourceResult>;
  prompts(): Promise<McpListPromptsResult>;
  prompt(input: McpSessionGetPromptInput): Promise<McpGetPromptResult>;
  call(input: McpSessionCallInput): Promise<McpCallResult>;
  disconnect(): Promise<void>;
}

export interface McpProviderShell {
  id: string;
  provider: ProviderId;
  layer: Exclude<SdkLayer, "auto">;
  officialCarrier: string;
  carrierKind: McpCarrierKind;
  loweringMode: McpLoweringMode;
  isDefault?: boolean;
  supportedTransports: McpTransportKind[];
  nativeSupportedTransports?: readonly McpTransportKind[];
  nativeSupportsResources?: boolean;
  nativeSupportsPrompts?: boolean;
  nativeSupportsServe?: boolean;
  supportsServe: boolean;
  // These flags describe the carrier surface modeled by this shell.
  supportsResources?: boolean;
  supportsPrompts?: boolean;
  notes?: string[];
}

export interface McpRuntimeOptions {
  clientInfo?: {
    name: string;
    version: string;
  };
  clientCapabilities?: ClientCapabilities;
  providerShells?: readonly McpProviderShell[];
}

export interface OpenAIApiNativeMcpPreparePayload {
  carrier: {
    type: "openai-api-mcp";
    shape: "responses-remote-mcp-tool";
  };
  toolsOnly: true;
  tools: Array<{
    type: "mcp";
    server_label: string;
    server_url: string;
  }>;
}

export interface OpenAIAgentNativeMcpPreparePayload {
  carrier: {
    type: "openai-agents-mcp";
    shape: "agent-local-stdio" | "agent-remote-hosted" | "agent-runtime-fixture";
  };
  toolsOnly: true;
  mcpServer:
    | {
        transport: "stdio";
        command: string;
        args?: string[];
        env?: Record<string, string>;
        cwd?: string;
      }
    | {
        transport: "streamable-http";
        url: string;
        headers?: Record<string, string>;
      }
    | {
        transport: "in-memory-fixture";
      };
}

export interface AnthropicApiNativeMcpPreparePayload {
  carrier: {
    type: "anthropic-api-mcp-connector";
    shape: "messages-mcp-connector";
  };
  toolsOnly: true;
  mcp_servers: Array<{
    type: "url";
    name: string;
    url: string;
  }>;
  tools: Array<{
    type: "mcp_toolset";
    mcp_server_name: string;
  }>;
}

export interface AnthropicAgentNativeMcpPreparePayload {
  carrier: {
    type: "anthropic-agent-runtime-mcp";
    runtime: "claude-agent-code";
    locality: "local-preferred" | "remote-capable";
  };
  transport: {
    kind: McpTransportKind;
  };
  mcpServers: Record<string, unknown>;
  surface: {
    tools: {
      supported: true;
      mode: "native";
    };
    resources: {
      supported: true;
      mode: "runtime-mediated";
    };
    prompts: {
      supported: true;
      mode: "runtime-mediated";
    };
    serve: {
      supported: false;
    };
  };
}

export interface DeepMindApiNativeMcpPreparePayload {
  carrier: {
    type: "gemini-api-mcp";
    shape: "model-side-tool-bridge";
  };
  toolsOnly: true;
  mcpBridge: {
    transportKind: McpTransportKind;
    source: Record<string, unknown>;
  };
}

export interface DeepMindAgentNativeMcpPreparePayload {
  carrier: {
    type: "google-adk-mcp-runtime";
    runtime: "adk-agent-runtime";
  };
  toolset: {
    kind: "google-adk-mcp-toolset";
    toolsetFactory: "McpToolset";
    connectionParams: Record<string, unknown>;
  };
  surface: {
    tools: {
      supported: true;
      mode: "native";
    };
    resources: {
      supported: false;
    };
    prompts: {
      supported: false;
    };
    serve: {
      supported: false;
    };
  };
}

export type McpNativePreparePayload =
  | OpenAIApiNativeMcpPreparePayload
  | OpenAIAgentNativeMcpPreparePayload
  | AnthropicApiNativeMcpPreparePayload
  | AnthropicAgentNativeMcpPreparePayload
  | DeepMindApiNativeMcpPreparePayload
  | DeepMindAgentNativeMcpPreparePayload;

export interface McpNativePrepareResult {
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  shellId: string;
  builderId: string;
  officialCarrier: string;
  carrierKind: McpCarrierKind;
  loweringMode: McpLoweringMode;
  transportKind: McpTransportKind;
  supported: boolean;
  unsupportedReasons?: string[];
  constraintSnapshot: {
    nativeSupportedTransports: readonly McpTransportKind[];
    supportedModelHints?: readonly string[];
    supportsResources: boolean;
    supportsPrompts: boolean;
    supportsServe: boolean;
  };
  supportsResources: boolean;
  supportsPrompts: boolean;
  supportsServe: boolean;
  sdkPackageName?: string;
  entrypoint?: string;
  payload?: McpNativePreparePayload;
  notes: string[];
}
