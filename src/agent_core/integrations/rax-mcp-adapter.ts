import { randomUUID } from "node:crypto";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  CapabilityResultEnvelope,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import type { ProviderId, SdkLayer } from "../../rax/types.js";
import type {
  McpCallInput,
  McpCallResult,
  McpListResourcesInput,
  McpListResourcesResult,
  McpListToolsInput,
  McpListToolsResult,
  McpReadResourceInput,
  McpReadResourceResult,
  McpConnectInput,
  McpInMemoryTransportConfig,
  McpStdioTransportConfig,
  McpStreamableHttpTransportConfig,
} from "../../rax/mcp-types.js";
import type { RaxFacade } from "../../rax/facade.js";
import { rax } from "../../rax/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import {
  createCapabilityManifestFromPackage,
  createMcpReadCapabilityPackage,
  createMcpCapabilityPackage,
  isSupportedMcpCapabilityPackageKey,
  type CapabilityPackage,
  type SupportedMcpCapabilityPackageKey,
} from "../capability-package/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type {
  ActivationAdapterFactory,
  ActivationAdapterFactoryContext,
} from "../ta-pool-runtime/index.js";

export const MCP_READ_FAMILY_ACTIONS = [
  "mcp.listTools",
  "mcp.listResources",
  "mcp.readResource",
] as const;

export type McpReadFamilyAction = (typeof MCP_READ_FAMILY_ACTIONS)[number];

type SupportedMcpAction =
  | "mcp.call"
  | McpReadFamilyAction
  | "mcp.native.execute";

export const RAX_MCP_CAPABILITY_KEYS = [
  ...MCP_READ_FAMILY_ACTIONS,
  "mcp.call",
  "mcp.native.execute",
] as const;

export type RaxMcpCapabilityKey = (typeof RAX_MCP_CAPABILITY_KEYS)[number];

interface McpRouteSelection {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
}

interface McpActionPayloadMap {
  "mcp.call": McpCallInput;
  "mcp.listTools": McpListToolsInput;
  "mcp.listResources": McpListResourcesInput;
  "mcp.readResource": McpReadResourceInput;
  "mcp.native.execute": McpConnectInput;
}

type McpCallBackendKind =
  | "openai-codex-style-mcp-call"
  | "anthropic-claude-code-mcp-call"
  | "gemini-cli-mcp-call"
  | "shared-runtime-mcp-call";

type SupportedMcpPreparedPayload = {
  action: SupportedMcpAction;
  route: McpRouteSelection;
  input: McpCallInput | McpListToolsInput | McpReadResourceInput | McpConnectInput;
  invocation?: Awaited<ReturnType<RaxFacade["mcp"]["native"]["build"]>>;
};

const DEFAULT_MCP_CAPABILITY_PACKAGES = new Map(
  (["mcp.call", "mcp.native.execute"] as const).map((capabilityKey) => [
    capabilityKey,
    createMcpCapabilityPackage({ capabilityKey }),
  ]),
);

export interface RaxMcpAdapterPlanInput<TAction extends SupportedMcpAction = SupportedMcpAction> {
  route: McpRouteSelection;
  input: McpActionPayloadMap[TAction];
}

export interface CreateRaxMcpCapabilityAdapterOptions {
  facade?: Pick<RaxFacade, "mcp">;
}

export interface RegisterRaxMcpCapabilitiesInput {
  runtime: {
    registerCapabilityAdapter(
      manifest: CapabilityManifest,
      adapter: CapabilityAdapter,
    ): unknown;
    registerTaActivationFactory(
      ref: string,
      factory: ActivationAdapterFactory,
    ): void;
  };
  facade?: Pick<RaxFacade, "mcp">;
  capabilityKeys?: readonly RaxMcpCapabilityKey[];
}

export interface RegisterRaxMcpCapabilitiesResult {
  capabilityKeys: RaxMcpCapabilityKey[];
  packages: CapabilityPackage[];
  manifests: CapabilityManifest[];
  bindings: unknown[];
  activationFactoryRefs: string[];
  adapter: RaxMcpCapabilityAdapter;
}

export function isMcpReadFamilyAction(action: string): action is McpReadFamilyAction {
  return MCP_READ_FAMILY_ACTIONS.includes(action as McpReadFamilyAction);
}

export interface CreateRaxMcpCapabilityManifestOptions {
  capabilityKey: SupportedMcpCapabilityPackageKey;
  capabilityId?: string;
  version?: string;
  generation?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

function isSupportedAction(action: string): action is SupportedMcpAction {
  return (
    action === "mcp.call" ||
    isMcpReadFamilyAction(action) ||
    action === "mcp.native.execute"
  );
}

function createCapabilityPackageForAction(
  action: SupportedMcpAction,
): CapabilityPackage {
  if (isMcpReadFamilyAction(action)) {
    return createMcpReadCapabilityPackage({
      capabilityKey: action,
    });
  }

  return createMcpCapabilityPackage({
    capabilityKey: action,
  });
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringRecord(
  value: unknown,
): Record<string, string> | undefined {
  const record = asObject(value);
  if (!record) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

function asArrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function sanitizeMcpNamePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function parseQualifiedMcpToolName(value: string): { serverName?: string; toolName: string } {
  if (value.startsWith("mcp_")) {
    const withoutPrefix = value.slice("mcp_".length);
    const match = withoutPrefix.match(/^([^_]+)_(.+)$/u);
    if (match) {
      return {
        serverName: match[1],
        toolName: match[2],
      };
    }
  }

  const colonSplit = value.match(/^([^:]+)::(.+)$/u);
  if (colonSplit) {
    return {
      serverName: colonSplit[1],
      toolName: colonSplit[2],
    };
  }

  return { toolName: value };
}

function formatQualifiedMcpToolName(serverName: string | undefined, toolName: string): string | undefined {
  if (!serverName) {
    return undefined;
  }
  return `mcp_${sanitizeMcpNamePart(serverName)}_${toolName}`;
}

function selectMcpCallBackend(route: McpRouteSelection): McpCallBackendKind {
  if (route.provider === "openai") {
    return "openai-codex-style-mcp-call";
  }
  if (route.provider === "anthropic") {
    return "anthropic-claude-code-mcp-call";
  }
  if (route.provider === "deepmind") {
    return "gemini-cli-mcp-call";
  }
  return "shared-runtime-mcp-call";
}

function getCapabilityPackageMetadata(
  action: SupportedMcpAction,
): Record<string, unknown> | undefined {
  if (!isSupportedMcpCapabilityPackageKey(action)) {
    return undefined;
  }

  const capabilityPackage = DEFAULT_MCP_CAPABILITY_PACKAGES.get(action);
  if (!capabilityPackage) {
    return undefined;
  }

  return {
    capabilityPackageKey: capabilityPackage.manifest.capabilityKey,
    capabilityPackageVersion: capabilityPackage.manifest.version,
    recommendedMode: capabilityPackage.policy.recommendedMode,
    riskLevel: capabilityPackage.policy.riskLevel,
    reviewRequirements: capabilityPackage.policy.reviewRequirements,
    humanGateRequirements: capabilityPackage.policy.humanGateRequirements,
  };
}

function parseRouteSelection(input: Record<string, unknown>): McpRouteSelection {
  const route = asObject(input.route);
  const provider = asString(route?.provider) as ProviderId | undefined;
  const model = asString(route?.model);
  if (!provider) {
    throw new Error("MCP adapter input is missing route.provider.");
  }
  if (!model) {
    throw new Error("MCP adapter input is missing route.model.");
  }

  const layerCandidate = asString(route?.layer);
  const layer: SdkLayer | undefined =
    layerCandidate === "api" || layerCandidate === "agent" || layerCandidate === "auto"
      ? layerCandidate
      : undefined;

  return {
    provider,
    model,
    layer,
    variant: asString(route?.variant),
    compatibilityProfileId: asString(route?.compatibilityProfileId),
  };
}

function readOptionalCallInput(input: Record<string, unknown>): Omit<McpCallInput, "connectionId"> & { connectionId?: string } {
  const payload = asObject(input.input);
  const rawToolName =
    asString(payload?.toolName)
    ?? asString(payload?.qualifiedToolName)
    ?? asString(payload?.name);
  if (!rawToolName) {
    throw new Error("MCP call input is missing toolName.");
  }
  const parsedToolIdentity = parseQualifiedMcpToolName(rawToolName);
  const serverName = asString(payload?.serverName) ?? parsedToolIdentity.serverName;
  const toolName = parsedToolIdentity.toolName;
  const connectionId = asString(payload?.connectionId);
  return {
    connectionId,
    toolName,
    arguments: asObject(payload?.arguments),
    serverName,
    qualifiedToolName: formatQualifiedMcpToolName(serverName, toolName),
  };
}

function readOptionalListToolsInput(input: Record<string, unknown>): { connectionId?: string } {
  const payload = asObject(input.input);
  return {
    connectionId: asString(payload?.connectionId),
  };
}

function readOptionalListResourcesInput(input: Record<string, unknown>): { connectionId?: string } {
  const payload = asObject(input.input);
  return {
    connectionId: asString(payload?.connectionId),
  };
}

function readOptionalReadResourceInput(input: Record<string, unknown>): Omit<McpReadResourceInput, "connectionId"> & { connectionId?: string } {
  const payload = asObject(input.input);
  const uri = asString(payload?.uri);
  if (!uri) {
    throw new Error("MCP readResource input is missing uri.");
  }
  return {
    connectionId: asString(payload?.connectionId),
    uri,
  };
}

function parseNativeExecuteInput(input: Record<string, unknown>): McpConnectInput {
  const payload = asObject(input.input);
  const transport = asObject(payload?.transport);
  const kind = asString(transport?.kind);
  if (!kind || (kind !== "stdio" && kind !== "streamable-http" && kind !== "in-memory")) {
    throw new Error("MCP native.execute input is missing a supported transport.kind.");
  }
  const strategyCandidate = asString(payload?.strategy);
  const strategy = strategyCandidate === "auto"
    || strategyCandidate === "shared-runtime"
    || strategyCandidate === "provider-native"
    ? strategyCandidate
    : undefined;
  const connectionId = asString(payload?.connectionId);
  const metadata = asObject(payload?.metadata);

  switch (kind) {
    case "stdio": {
      const command = asString(transport?.command);
      if (!command) {
        throw new Error("MCP native.execute stdio transport requires a non-empty command.");
      }
      const stdioTransport: McpStdioTransportConfig = {
        kind,
        command,
        args: asArrayOfStrings(transport?.args),
        env: asStringRecord(transport?.env),
        cwd: asString(transport?.cwd),
        stderr: transport?.stderr as McpStdioTransportConfig["stderr"],
      };
      return {
        connectionId,
        strategy,
        metadata,
        transport: stdioTransport,
      };
    }
    case "streamable-http": {
      const url = asString(transport?.url);
      if (!url) {
        throw new Error("MCP native.execute streamable-http transport requires a non-empty url.");
      }
      const streamableHttpTransport: McpStreamableHttpTransportConfig = {
        kind,
        url,
        headers: asStringRecord(transport?.headers),
      };
      return {
        connectionId,
        strategy,
        metadata,
        transport: streamableHttpTransport,
      };
    }
    case "in-memory": {
      if (!transport?.transport || typeof transport.transport !== "object") {
        throw new Error("MCP native.execute in-memory transport requires a transport object.");
      }
      const inMemoryTransport: McpInMemoryTransportConfig = {
        kind,
        transport: transport.transport as McpInMemoryTransportConfig["transport"],
      };
      return {
        connectionId,
        strategy,
        metadata,
        transport: inMemoryTransport,
      };
    }
  }
}

function createFailureEnvelope(params: {
  executionId: string;
  code: string;
  error: unknown;
  metadata?: Record<string, unknown>;
}): CapabilityResultEnvelope {
  return createCapabilityResultEnvelope({
    executionId: params.executionId,
    status: "failed",
    error: {
      code: params.code,
      message: params.error instanceof Error ? params.error.message : String(params.error),
    },
    metadata: params.metadata,
  });
}

function createExecutionMetadata(action: SupportedMcpAction, route: McpRouteSelection, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    capability: action,
    actionFamily: isMcpReadFamilyAction(action) ? "read" : "invoke",
    provider: route.provider,
    model: route.model,
    layer: route.layer,
    ...getCapabilityPackageMetadata(action),
    ...extra,
  };
}

function normalizeMcpCallResult(
  route: McpRouteSelection,
  input: McpCallInput,
  result: McpCallResult,
): McpCallResult {
  const backend = selectMcpCallBackend(route);
  const rawRecord = asObject(result.raw);
  const content = Array.isArray(result.content)
    ? result.content
    : Array.isArray(rawRecord?.content)
      ? (rawRecord.content as unknown[])
      : [];
  const structuredCandidate = result.structuredContent ?? asObject(rawRecord?.structuredContent);
  const structuredContent =
    structuredCandidate && typeof structuredCandidate === "object"
      ? structuredCandidate
      : {};
  const meta = asObject(result._meta) ?? asObject(rawRecord?._meta);
  const serverName = input.serverName ?? result.serverName;
  const qualifiedToolName =
    input.qualifiedToolName
    ?? result.qualifiedToolName
    ?? formatQualifiedMcpToolName(serverName, input.toolName);

  return {
    ...result,
    connectionId: input.connectionId,
    toolName: input.toolName,
    serverName,
    qualifiedToolName,
    content,
    structuredContent,
    isError: result.isError === true,
    _meta: meta,
    raw: {
      ...(rawRecord ?? {}),
      backend,
      qualifiedToolName,
    },
  };
}

function readCapabilityKeyFromActivationContext(
  context: ActivationAdapterFactoryContext,
): SupportedMcpAction {
  const manifestCapabilityKey = context.manifest?.capabilityKey;
  if (manifestCapabilityKey && isSupportedAction(manifestCapabilityKey)) {
    return manifestCapabilityKey;
  }

  const packageCapabilityKey = context.capabilityPackage?.manifest.capabilityKey;
  if (packageCapabilityKey && isSupportedAction(packageCapabilityKey)) {
    return packageCapabilityKey;
  }

  const activationCapabilityKey = asString(context.activationSpec?.manifestPayload?.capabilityKey);
  if (activationCapabilityKey && isSupportedAction(activationCapabilityKey)) {
    return activationCapabilityKey;
  }

  throw new Error(
    "RAX MCP activation factory requires one of mcp.listTools, mcp.listResources, mcp.readResource, mcp.call, or mcp.native.execute.",
  );
}

export function createRaxMcpCapabilityManifest(
  options: CreateRaxMcpCapabilityManifestOptions,
) {
  const capabilityPackage = createMcpCapabilityPackage({
    capabilityKey: options.capabilityKey,
    version: options.version,
    generation: options.generation,
  });

  return {
    capabilityId:
      options.capabilityId
      ?? `cap.${options.capabilityKey.replace(/\./g, "-")}`,
    capabilityKey: capabilityPackage.manifest.capabilityKey,
    kind: capabilityPackage.manifest.capabilityKind,
    version: capabilityPackage.manifest.version,
    generation: capabilityPackage.manifest.generation,
    description: options.description ?? capabilityPackage.manifest.description,
    supportsPrepare: true,
    supportsCancellation: options.capabilityKey === "mcp.native.execute",
    routeHints: capabilityPackage.manifest.routeHints,
    tags: capabilityPackage.manifest.tags,
    metadata: {
      ...(options.metadata ?? {}),
      capabilityPackage,
      riskLevel: capabilityPackage.policy.riskLevel,
      recommendedMode: capabilityPackage.policy.recommendedMode,
      truthfulness: capabilityPackage.metadata?.truthfulness,
    },
  };
}

export class RaxMcpCapabilityAdapter implements CapabilityAdapter {
  readonly id = "rax.mcp.adapter";
  readonly runtimeKind = "rax-mcp";
  readonly #facade: Pick<RaxFacade, "mcp">;
  readonly #preparedPayloads = new Map<string, SupportedMcpPreparedPayload>();

  constructor(options: CreateRaxMcpCapabilityAdapterOptions = {}) {
    this.#facade = options.facade ?? rax;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    return isSupportedAction(plan.capabilityKey);
  }

  async #resolveImplicitConnectionId(route: McpRouteSelection): Promise<string | undefined> {
    const connections = this.#facade.mcp.listConnections({
      provider: route.provider,
      model: route.model,
      layer: route.layer,
      input: {},
    });
    return connections.length === 1 ? connections[0]?.connectionId : undefined;
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    if (!this.supports(plan)) {
      throw new Error(`Unsupported MCP capability action: ${plan.capabilityKey}.`);
    }

    const action = plan.capabilityKey as SupportedMcpAction;
    const route = parseRouteSelection(plan.input);
    const inputRecord = asObject(plan.input) ?? {};
    let parsed: SupportedMcpPreparedPayload;

    switch (action) {
      case "mcp.call": {
        const partial = readOptionalCallInput(inputRecord);
        const connectionId = partial.connectionId ?? await this.#resolveImplicitConnectionId(route);
        if (!connectionId) {
          throw new Error("MCP call input is missing connectionId.");
        }
        parsed = {
          action,
          route,
          input: {
            ...partial,
            connectionId,
          },
        };
        break;
      }
      case "mcp.listTools": {
        const partial = readOptionalListToolsInput(inputRecord);
        const connectionId = partial.connectionId ?? await this.#resolveImplicitConnectionId(route);
        if (!connectionId) {
          throw new Error("MCP listTools input is missing connectionId.");
        }
        parsed = {
          action,
          route,
          input: {
            connectionId,
          },
        };
        break;
      }
      case "mcp.listResources": {
        const partial = readOptionalListResourcesInput(inputRecord);
        const connectionId = partial.connectionId ?? await this.#resolveImplicitConnectionId(route);
        if (!connectionId) {
          throw new Error("MCP listResources input is missing connectionId.");
        }
        parsed = {
          action,
          route,
          input: {
            connectionId,
          },
        };
        break;
      }
      case "mcp.readResource": {
        const partial = readOptionalReadResourceInput(inputRecord);
        const connectionId = partial.connectionId ?? await this.#resolveImplicitConnectionId(route);
        if (!connectionId) {
          throw new Error("MCP readResource input is missing connectionId.");
        }
        parsed = {
          action,
          route,
          input: {
            ...partial,
            connectionId,
          },
        };
        break;
      }
      case "mcp.native.execute":
        parsed = {
          action,
          route,
          input: parseNativeExecuteInput(inputRecord),
        };
        break;
    }

    let preparedPayload: SupportedMcpPreparedPayload;
    if (parsed.action === "mcp.native.execute") {
      const invocation = this.#facade.mcp.native.build({
        provider: parsed.route.provider,
        model: parsed.route.model,
        layer: parsed.route.layer,
        variant: parsed.route.variant,
        compatibilityProfileId: parsed.route.compatibilityProfileId,
        input: parsed.input as McpConnectInput,
      });
      preparedPayload = { ...parsed, invocation };
    } else {
      preparedPayload = parsed;
    }

    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: parsed.action === "mcp.native.execute" ? "long-running" : "direct",
      preparedPayloadRef: `${this.id}:${plan.planId}`,
      cacheKey: plan.idempotencyKey,
      metadata: {
        ...(plan.metadata ?? {}),
        ...getCapabilityPackageMetadata(parsed.action),
      },
    });
    this.#preparedPayloads.set(prepared.preparedId, preparedPayload);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall): Promise<CapabilityResultEnvelope> {
    const payload = this.#preparedPayloads.get(prepared.preparedId);
    if (!payload) {
      return createFailureEnvelope({
        executionId: prepared.preparedId,
        code: "rax_mcp_prepared_payload_missing",
        error: new Error(`Prepared payload ${prepared.preparedId} was not found.`),
      });
    }

    try {
      switch (payload.action) {
        case "mcp.call":
          return this.#executeCall(prepared.preparedId, payload.route, payload.input as McpCallInput);
        case "mcp.listTools":
          return this.#executeListTools(prepared.preparedId, payload.route, payload.input as McpListToolsInput);
        case "mcp.listResources":
          return this.#executeListResources(prepared.preparedId, payload.route, payload.input as McpListResourcesInput);
        case "mcp.readResource":
          return this.#executeReadResource(prepared.preparedId, payload.route, payload.input as McpReadResourceInput);
        case "mcp.native.execute":
          return this.#executeNative(
            prepared.preparedId,
            payload.route,
            payload.invocation as Awaited<ReturnType<RaxFacade["mcp"]["native"]["build"]>>,
          );
      }
    } catch (error) {
      return createFailureEnvelope({
        executionId: prepared.preparedId,
        code: "rax_mcp_execute_failed",
        error,
        metadata: createExecutionMetadata(payload.action, payload.route),
      });
    }
  }

  async #executeCall(
    executionId: string,
    route: McpRouteSelection,
    input: McpCallInput,
  ): Promise<CapabilityResultEnvelope> {
    const rawResult = await this.#facade.mcp.call({
      provider: route.provider,
      model: route.model,
      layer: route.layer,
      variant: route.variant,
      compatibilityProfileId: route.compatibilityProfileId,
      input,
    });
    const result = normalizeMcpCallResult(route, input, rawResult);
    const selectedBackend = selectMcpCallBackend(route);

    return createCapabilityResultEnvelope({
        executionId,
        status: this.#resultStatusFromCallResult(result),
        output: result,
        metadata: createExecutionMetadata("mcp.call", route, {
          connectionId: input.connectionId,
          toolName: input.toolName,
          serverName: input.serverName,
          qualifiedToolName: result.qualifiedToolName,
          selectedBackend,
          resolvedBackend: selectedBackend,
          resultContentCount: result.content?.length ?? 0,
          hasStructuredContent:
            !!result.structuredContent && Object.keys(result.structuredContent).length > 0,
        }),
        error: result.isError
          ? {
              code: "rax_mcp_call_error",
              message: result.errorMessage ?? "MCP call returned isError=true.",
            }
          : undefined,
      });
  }

  async #executeListTools(
    executionId: string,
    route: McpRouteSelection,
    input: McpListToolsInput,
  ): Promise<CapabilityResultEnvelope> {
    const result = await this.#facade.mcp.listTools({
      provider: route.provider,
      model: route.model,
      layer: route.layer,
      variant: route.variant,
      compatibilityProfileId: route.compatibilityProfileId,
      input,
    });

    return createCapabilityResultEnvelope({
      executionId,
      status: "success",
      output: result,
      metadata: createExecutionMetadata("mcp.listTools", route, {
        connectionId: input.connectionId,
        toolCount: result.tools.length,
      }),
    });
  }

  async #executeListResources(
    executionId: string,
    route: McpRouteSelection,
    input: McpListResourcesInput,
  ): Promise<CapabilityResultEnvelope> {
    const result = await this.#facade.mcp.listResources({
      provider: route.provider,
      model: route.model,
      layer: route.layer,
      variant: route.variant,
      compatibilityProfileId: route.compatibilityProfileId,
      input,
    });

    return createCapabilityResultEnvelope({
      executionId,
      status: "success",
      output: result,
      metadata: createExecutionMetadata("mcp.listResources", route, {
        connectionId: input.connectionId,
        resourceCount: result.resources.length,
      }),
    });
  }

  async #executeReadResource(
    executionId: string,
    route: McpRouteSelection,
    input: McpReadResourceInput,
  ): Promise<CapabilityResultEnvelope> {
    const result = await this.#facade.mcp.readResource({
      provider: route.provider,
      model: route.model,
      layer: route.layer,
      variant: route.variant,
      compatibilityProfileId: route.compatibilityProfileId,
      input,
    });

    return createCapabilityResultEnvelope({
      executionId,
      status: "success",
      output: result,
      metadata: createExecutionMetadata("mcp.readResource", route, {
        connectionId: input.connectionId,
        uri: input.uri,
      }),
    });
  }

  async #executeNative(
    executionId: string,
    route: McpRouteSelection,
    invocation: Awaited<ReturnType<RaxFacade["mcp"]["native"]["build"]>>,
  ): Promise<CapabilityResultEnvelope> {
    const result = await this.#facade.mcp.native.execute(invocation);
    return createCapabilityResultEnvelope({
      executionId,
      status: "success",
      output: result,
      metadata: createExecutionMetadata("mcp.native.execute", route, {
        invocationKey: invocation.key,
        adapterId: invocation.adapterId,
      }),
    });
  }

  #resultStatusFromCallResult(result: McpCallResult): CapabilityResultEnvelope["status"] {
    return result.isError ? "failed" : "success";
  }
}

export function createRaxMcpCapabilityAdapter(
  options: CreateRaxMcpCapabilityAdapterOptions = {},
): RaxMcpCapabilityAdapter {
  return new RaxMcpCapabilityAdapter(options);
}

export function createRaxMcpActivationFactory(
  options: CreateRaxMcpCapabilityAdapterOptions = {},
): ActivationAdapterFactory {
  return (context) => {
    readCapabilityKeyFromActivationContext(context);
    return createRaxMcpCapabilityAdapter(options);
  };
}

export function registerRaxMcpCapabilities(
  input: RegisterRaxMcpCapabilitiesInput,
): RegisterRaxMcpCapabilitiesResult {
  const capabilityKeys = [
    ...(input.capabilityKeys ?? RAX_MCP_CAPABILITY_KEYS),
  ];
  const packages = capabilityKeys.map((capabilityKey) =>
    createCapabilityPackageForAction(capabilityKey),
  );
  const manifests = packages.map((capabilityPackage) =>
    createCapabilityManifestFromPackage(capabilityPackage),
  );
  const adapter = createRaxMcpCapabilityAdapter({
    facade: input.facade,
  });
  const activationFactory = createRaxMcpActivationFactory({
    facade: input.facade,
  });
  const activationFactoryRefs = [
    ...new Set(
      packages.map((capabilityPackage) => {
        const activationFactoryRef =
          capabilityPackage.activationSpec?.adapterFactoryRef;
        if (!activationFactoryRef) {
          throw new Error(
            `Capability package ${capabilityPackage.manifest.capabilityKey} is missing adapterFactoryRef.`,
          );
        }
        return activationFactoryRef;
      }),
    ),
  ];

  for (const ref of activationFactoryRefs) {
    input.runtime.registerTaActivationFactory(ref, activationFactory);
  }

  const bindings = manifests.map((manifest) =>
    input.runtime.registerCapabilityAdapter(manifest, adapter),
  );

  return {
    capabilityKeys,
    packages,
    manifests,
    bindings,
    activationFactoryRefs,
    adapter,
  };
}
