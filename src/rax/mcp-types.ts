import type { IOType } from "node:child_process";
import type { Stream } from "node:stream";

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ClientCapabilities, ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";

import type { ProviderId, SdkLayer } from "./types.js";

export type McpTransportKind = "stdio" | "streamable-http" | "in-memory";

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
}

export interface McpConnectionSummary {
  connectionId: string;
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
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
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  errorMessage?: string;
  raw?: unknown;
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
  defaultLayer: Exclude<SdkLayer, "auto">;
  supportedTransports: McpTransportKind[];
  supportsServe: boolean;
  // These flags describe the runtime surface currently exposed through rax, not an aspirational future state.
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
