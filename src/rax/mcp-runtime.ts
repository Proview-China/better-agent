import { randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import {
  MissingAdapterError,
  RaxRoutingError
} from "./errors.js";
import {
  MCP_PROVIDER_SHELLS
} from "./mcp-shells.js";
import type {
  McpCallInput,
  McpCallResult,
  McpConnectionSummary,
  McpConnectInput,
  McpGetPromptInput,
  McpGetPromptResult,
  McpListToolsInput,
  McpListPromptsInput,
  McpListPromptsResult,
  McpListResourcesInput,
  McpListResourcesResult,
  McpListToolsResult,
  McpProviderShell,
  McpPromptSummary,
  McpReadResourceInput,
  McpReadResourceResult,
  McpRuntimeOptions,
  McpResourceSummary,
  McpToolSummary,
  McpTransportConfig
} from "./mcp-types.js";
import type { CapabilityResult, ProviderId, SdkLayer } from "./types.js";

interface McpConnectionRecord {
  id: string;
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  profileId?: string;
  shellId: string;
  officialCarrier: string;
  carrierKind: McpProviderShell["carrierKind"];
  loweringMode: McpProviderShell["loweringMode"];
  supportsResources: boolean;
  supportsPrompts: boolean;
  client: Client;
  transportKind: McpTransportConfig["kind"];
  metadata?: Record<string, unknown>;
}

interface McpRouteParams {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  compatibilityProfileId?: string;
}

function classifyMcpError(error: unknown, fallbackCode: string): RaxRoutingError {
  if (error instanceof RaxRoutingError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes("unauthorized") || lowered.includes("401") || lowered.includes("auth")) {
    return new RaxRoutingError("mcp_auth_error", message);
  }

  if (
    fallbackCode === "mcp_connection_failed"
    && (
      lowered.includes("enoent")
      || lowered.includes("eacces")
      || lowered.includes("spawn")
      || lowered.includes("not recognized as an internal or external command")
      || lowered.includes("operable program or batch file")
      || lowered.includes("no such file or directory")
      || lowered.includes("permission denied")
      || lowered.includes("connection closed")
    )
  ) {
    return new RaxRoutingError(fallbackCode, message);
  }

  if (lowered.includes("transport") || lowered.includes("connection")) {
    return new RaxRoutingError("mcp_transport_error", message);
  }

  return new RaxRoutingError(fallbackCode, message);
}

export class McpRuntime {
  readonly #connections = new Map<string, McpConnectionRecord>();
  readonly #clientInfo: { name: string; version: string };
  readonly #providerShells: readonly McpProviderShell[];
  readonly #clientCapabilities: McpRuntimeOptions["clientCapabilities"];

  constructor(options: McpRuntimeOptions = {}) {
    this.#clientInfo = options.clientInfo ?? {
      name: "rax",
      version: "0.1.0"
    };
    this.#providerShells = options.providerShells ?? MCP_PROVIDER_SHELLS;
    this.#clientCapabilities = options.clientCapabilities;
  }

  listConnections(params: McpRouteParams): McpConnectionSummary[] {
    return [...this.#connections.values()]
      .filter((record) => this.matchesConnectionRoute(record, params))
      .map((record) => this.toConnectionSummary(record));
  }

  listConnectionIds(): string[] {
    return [...this.#connections.keys()];
  }

  getProviderShell(
    provider: ProviderId,
    layer?: SdkLayer,
    transportKind?: McpTransportConfig["kind"]
  ): McpProviderShell {
    const shells = this.#providerShells.filter((entry) => entry.provider === provider);
    if (shells.length === 0) {
      throw new MissingAdapterError(
        "mcp.connect",
        provider,
        "auto",
        `Missing MCP provider shell for ${provider}.`
      );
    }

    if (layer !== undefined && layer !== "auto") {
      const exact = shells.find((entry) => entry.layer === layer);
      if (!exact) {
        throw new RaxRoutingError(
          "mcp_layer_mismatch",
          `${provider} MCP shells are registered for layers ${shells.map((entry) => entry.layer).join(", ")}, received ${layer}.`
        );
      }
      return exact;
    }

    const transportMatched = transportKind === undefined
      ? shells
      : shells.filter((entry) => entry.supportedTransports.includes(transportKind));

    return transportMatched.find((entry) => entry.isDefault)
      ?? shells.find((entry) => entry.isDefault)
      ?? transportMatched[0]
      ?? shells[0]!;
  }

  async connect(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpConnectInput;
  }): Promise<McpConnectionSummary> {
    const shell = this.getProviderShell(
      params.provider,
      params.layer,
      params.input.transport.kind
    );
    const layer = shell.layer;

    if (!shell.supportedTransports.includes(params.input.transport.kind)) {
      throw new RaxRoutingError(
        "mcp_transport_unsupported",
        `${params.provider} MCP shell does not support transport ${params.input.transport.kind}.`
      );
    }

    const connectionId = params.input.connectionId ?? randomUUID();
    const existing = this.#connections.get(connectionId);

    const client = new Client(this.#clientInfo, {
      capabilities: this.#clientCapabilities ?? {}
    });
    const transport = this.createTransport(params.input.transport);

    try {
      await client.connect(transport);
    } catch (error) {
      throw classifyMcpError(error, "mcp_connection_failed");
    }

    const record: McpConnectionRecord = {
      id: connectionId,
      provider: params.provider,
      model: params.model,
      layer,
      profileId: params.compatibilityProfileId,
      shellId: shell.id,
      officialCarrier: shell.officialCarrier,
      carrierKind: shell.carrierKind,
      loweringMode: shell.loweringMode,
      supportsResources: shell.supportsResources ?? false,
      supportsPrompts: shell.supportsPrompts ?? false,
      client,
      transportKind: params.input.transport.kind,
      metadata: params.input.metadata
    };

    if (existing) {
      try {
        await existing.client.close();
      } catch (error) {
        await client.close().catch(() => undefined);
        throw classifyMcpError(error, "mcp_connection_replacement_failed");
      }

      this.#connections.delete(connectionId);
    }

    this.#connections.set(connectionId, record);

    const serverVersion = client.getServerVersion();

    return {
      connectionId,
      provider: params.provider,
      model: params.model,
      layer,
      shellId: shell.id,
      officialCarrier: shell.officialCarrier,
      carrierKind: shell.carrierKind,
      loweringMode: shell.loweringMode,
      transportKind: params.input.transport.kind,
      profileId: params.compatibilityProfileId,
      serverCapabilities: client.getServerCapabilities(),
      serverVersion: serverVersion
        ? {
            name: serverVersion.name,
            version: serverVersion.version
          }
        : undefined,
      metadata: params.input.metadata
    };
  }

  private getConnectionOrThrow(
    connectionId: string
  ): McpConnectionRecord {
    const record = this.#connections.get(connectionId);
    if (!record) {
      throw new RaxRoutingError(
        "mcp_not_connected",
        `MCP connection ${connectionId} was not found.`
      );
    }
    return record;
  }

  private matchesConnectionRoute(
    record: McpConnectionRecord,
    params: McpRouteParams
  ): boolean {
    if (record.provider !== params.provider) {
      return false;
    }

    if (record.model !== params.model) {
      return false;
    }

    const expectedLayer =
      params.layer === undefined || params.layer === "auto"
        ? record.layer
        : params.layer;
    if (record.layer !== expectedLayer) {
      return false;
    }

    return (record.profileId ?? undefined) === (params.compatibilityProfileId ?? undefined);
  }

  private assertConnectionRoute(
    record: McpConnectionRecord,
    params: McpRouteParams
  ): void {
    if (this.matchesConnectionRoute(record, params)) {
      return;
    }

    if (record.provider !== params.provider) {
      throw new RaxRoutingError(
        "mcp_route_mismatch",
        `MCP connection ${record.id} belongs to provider ${record.provider}, not ${params.provider}.`
      );
    }

    if (record.model !== params.model) {
      throw new RaxRoutingError(
        "mcp_route_mismatch",
        `MCP connection ${record.id} belongs to model ${record.model}, not ${params.model}.`
      );
    }

    const expectedLayer =
      params.layer === undefined || params.layer === "auto"
        ? record.layer
        : params.layer;
    if (record.layer !== expectedLayer) {
      throw new RaxRoutingError(
        "mcp_route_mismatch",
        `MCP connection ${record.id} belongs to layer ${record.layer}, not ${expectedLayer}.`
      );
    }

    throw new RaxRoutingError(
      "mcp_route_mismatch",
      `MCP connection ${record.id} belongs to profile ${record.profileId ?? "none"}, not ${params.compatibilityProfileId ?? "none"}.`
    );
  }

  async listTools(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpListToolsInput;
  }): Promise<McpListToolsResult> {
    const record = this.getConnectionOrThrow(params.input.connectionId);
    this.assertConnectionRoute(record, params);

    try {
      const response = await record.client.listTools();
      return {
        connectionId: params.input.connectionId,
        tools: response.tools.map((tool): McpToolSummary => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations as Record<string, unknown> | undefined,
          raw: tool
        })),
        raw: response
      };
    } catch (error) {
      throw classifyMcpError(error, "mcp_list_tools_failed");
    }
  }

  async listResources(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpListResourcesInput;
  }): Promise<McpListResourcesResult> {
    const record = this.getConnectionOrThrow(params.input.connectionId);
    this.assertConnectionRoute(record, params);
    this.assertResourceSurface(record);

    try {
      const response = await record.client.listResources();
      return {
        connectionId: params.input.connectionId,
        resources: response.resources.map((resource): McpResourceSummary => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
          annotations: resource.annotations as Record<string, unknown> | undefined,
          raw: resource
        })),
        raw: response
      };
    } catch (error) {
      throw classifyMcpError(error, "mcp_list_resources_failed");
    }
  }

  async readResource(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpReadResourceInput;
  }): Promise<McpReadResourceResult> {
    const record = this.getConnectionOrThrow(params.input.connectionId);
    this.assertConnectionRoute(record, params);
    this.assertResourceSurface(record);

    try {
      const result = await record.client.readResource({ uri: params.input.uri });
      return {
        connectionId: params.input.connectionId,
        uri: params.input.uri,
        contents: result.contents as unknown[],
        raw: result
      };
    } catch (error) {
      throw classifyMcpError(error, "mcp_read_resource_failed");
    }
  }

  async listPrompts(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpListPromptsInput;
  }): Promise<McpListPromptsResult> {
    const record = this.getConnectionOrThrow(params.input.connectionId);
    this.assertConnectionRoute(record, params);
    this.assertPromptSurface(record);

    try {
      const response = await record.client.listPrompts();
      return {
        connectionId: params.input.connectionId,
        prompts: response.prompts.map((prompt): McpPromptSummary => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments?.map((argument) => ({
            name: argument.name,
            description: argument.description,
            required: argument.required
          })),
          raw: prompt
        })),
        raw: response
      };
    } catch (error) {
      throw classifyMcpError(error, "mcp_list_prompts_failed");
    }
  }

  async getPrompt(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpGetPromptInput;
  }): Promise<McpGetPromptResult> {
    const record = this.getConnectionOrThrow(params.input.connectionId);
    this.assertConnectionRoute(record, params);
    this.assertPromptSurface(record);

    try {
      const result = await record.client.getPrompt({
        name: params.input.name,
        arguments: params.input.arguments
      });

      return {
        connectionId: params.input.connectionId,
        name: params.input.name,
        messages: result.messages as unknown[],
        raw: result
      };
    } catch (error) {
      throw classifyMcpError(error, "mcp_get_prompt_failed");
    }
  }

  private assertResourceSurface(record: McpConnectionRecord): void {
    if (record.supportsResources) {
      return;
    }

    throw new RaxRoutingError(
      "mcp_surface_unsupported",
      `MCP connection ${record.id} on shell ${record.shellId} does not expose resources in the current carrier model.`
    );
  }

  private assertPromptSurface(record: McpConnectionRecord): void {
    if (record.supportsPrompts) {
      return;
    }

    throw new RaxRoutingError(
      "mcp_surface_unsupported",
      `MCP connection ${record.id} on shell ${record.shellId} does not expose prompts in the current carrier model.`
    );
  }

  async call(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    input: McpCallInput;
  }): Promise<McpCallResult> {
    const record = this.getConnectionOrThrow(params.input.connectionId);
    this.assertConnectionRoute(record, params);

    try {
      const tools = await record.client.listTools();
      const tool = tools.tools.find((entry) => entry.name === params.input.toolName);
      if (!tool) {
        throw new RaxRoutingError(
          "mcp_tool_not_found",
          `MCP tool ${params.input.toolName} was not found on connection ${params.input.connectionId}.`
        );
      }

      const result = await record.client.callTool({
        name: params.input.toolName,
        arguments: params.input.arguments
      });

      return {
        connectionId: params.input.connectionId,
        toolName: params.input.toolName,
        content: "content" in result ? (result.content as unknown[]) : undefined,
        structuredContent:
          "structuredContent" in result
            ? (result.structuredContent as Record<string, unknown> | undefined)
            : undefined,
        isError: "isError" in result ? (result.isError as boolean | undefined) : undefined,
        errorMessage:
          "isError" in result && result.isError
            ? `MCP tool ${params.input.toolName} reported an execution error.`
            : undefined,
        raw: result
      };
    } catch (error) {
      if (error instanceof RaxRoutingError) {
        throw error;
      }
      throw classifyMcpError(error, "mcp_tool_execution_failed");
    }
  }

  async disconnectAll(params: McpRouteParams): Promise<void> {
    const records = [...this.#connections.values()].filter((record) =>
      this.matchesConnectionRoute(record, params)
    );
    await Promise.all(
      records.map((record) =>
        this.disconnect({
          provider: params.provider,
          model: params.model,
          layer: params.layer,
          compatibilityProfileId: params.compatibilityProfileId,
          connectionId: record.id
        })
      )
    );
  }

  async disconnect(params: {
    provider: ProviderId;
    model: string;
    layer?: SdkLayer;
    compatibilityProfileId?: string;
    connectionId: string;
  }): Promise<void> {
    const record = this.#connections.get(params.connectionId);
    if (!record) {
      return;
    }

    this.assertConnectionRoute(record, params);

    await record.client.close();
    this.#connections.delete(params.connectionId);
  }

  private toConnectionSummary(record: McpConnectionRecord): McpConnectionSummary {
    return {
      connectionId: record.id,
      provider: record.provider,
      model: record.model,
      layer: record.layer,
      shellId: record.shellId,
      officialCarrier: record.officialCarrier,
      carrierKind: record.carrierKind,
      loweringMode: record.loweringMode,
      transportKind: record.transportKind,
      profileId: record.profileId,
      metadata: record.metadata
    };
  }

  private createTransport(config: McpTransportConfig) {
    switch (config.kind) {
      case "stdio":
        return new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: config.env,
          cwd: config.cwd,
          stderr: config.stderr
        });
      case "streamable-http":
        return new StreamableHTTPClientTransport(new URL(config.url), {
          requestInit: {
            headers: config.headers
          }
        });
      case "in-memory":
        return config.transport as never;
    }
  }
}

export function toMcpCapabilityResult<TOutput>(
  provider: ProviderId,
  model: string,
  layer: Exclude<SdkLayer, "auto">,
  action:
    | "connect"
    | "listConnections"
    | "listTools"
    | "listResources"
    | "readResource"
    | "listPrompts"
    | "getPrompt"
    | "call"
    | "disconnect"
    | "disconnectAll",
  output: TOutput,
  profileId?: string
): CapabilityResult<TOutput> {
  return {
    status: "success",
    provider,
    model,
    layer,
    compatibilityProfileId: profileId,
    capability: "mcp",
    action,
    output
  };
}
