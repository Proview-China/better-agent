import { randomUUID } from "node:crypto";

import type { CapabilityAdapter, CapabilityInvocationPlan, CapabilityLease, CapabilityResultEnvelope, PreparedCapabilityCall } from "../capability-types/index.js";
import type { ProviderId, SdkLayer } from "../../rax/types.js";
import type {
  McpCallInput,
  McpCallResult,
  McpListToolsInput,
  McpListToolsResult,
  McpReadResourceInput,
  McpReadResourceResult,
  McpConnectInput,
} from "../../rax/mcp-types.js";
import type { RaxFacade } from "../../rax/facade.js";
import { rax } from "../../rax/index.js";
import {
  createRaxComputerCapabilityPackage,
  createRaxMcpCapabilityPackage,
  summarizeCapabilityPackage,
} from "../capability-package/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";

const MCP_SHARED_ACTIONS = [
  "mcp.shared.call",
  "mcp.shared.listTools",
  "mcp.shared.readResource",
] as const;
const MCP_LEGACY_SHARED_ACTIONS = [
  "mcp.call",
  "mcp.listTools",
  "mcp.readResource",
] as const;
const MCP_NATIVE_ACTIONS = [
  "mcp.native.execute",
] as const;
const COMPUTER_ACTIONS = [
  "computer.use",
  "computer.observe",
  "computer.act",
] as const;

type McpSharedAction = (typeof MCP_SHARED_ACTIONS)[number];
type McpLegacySharedAction = (typeof MCP_LEGACY_SHARED_ACTIONS)[number];
type McpNativeAction = (typeof MCP_NATIVE_ACTIONS)[number];
type ComputerAction = (typeof COMPUTER_ACTIONS)[number];
type SupportedMcpAction = McpSharedAction | McpNativeAction;
type SupportedPublicCapabilityKey = SupportedMcpAction | ComputerAction;
type SupportedMcpKey = SupportedMcpAction | McpLegacySharedAction | ComputerAction;

interface McpRouteSelection {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
}

interface McpActionPayloadMap {
  "mcp.shared.call": McpCallInput;
  "mcp.shared.listTools": McpListToolsInput;
  "mcp.shared.readResource": McpReadResourceInput;
  "mcp.call": McpCallInput;
  "mcp.listTools": McpListToolsInput;
  "mcp.readResource": McpReadResourceInput;
  "mcp.native.execute": McpConnectInput;
  "computer.use": McpCallInput;
  "computer.observe": McpCallInput;
  "computer.act": McpCallInput;
}

type SupportedMcpPreparedPayload = {
  action: SupportedMcpAction;
  requestedCapabilityKey: string;
  publicCapabilityKey: SupportedPublicCapabilityKey;
  compatibilityAlias?: McpLegacySharedAction;
  route: McpRouteSelection;
  input: McpCallInput | McpListToolsInput | McpReadResourceInput | McpConnectInput;
  nativePlan?: ReturnType<RaxFacade["mcp"]["native"]["prepare"]>;
  invocation?: Awaited<ReturnType<RaxFacade["mcp"]["native"]["build"]>>;
};

export interface RaxMcpAdapterPlanInput<TAction extends SupportedMcpKey = SupportedMcpKey> {
  route: McpRouteSelection;
  input: McpActionPayloadMap[TAction];
}

export interface CreateRaxMcpCapabilityAdapterOptions {
  facade?: Pick<RaxFacade, "mcp">;
}

interface ResolvedMcpAction {
  dispatchAction: SupportedMcpAction;
  publicCapabilityKey: SupportedPublicCapabilityKey;
  compatibilityAlias?: McpLegacySharedAction;
}

function isComputerCapabilityKey(
  capabilityKey: SupportedPublicCapabilityKey,
): capabilityKey is ComputerAction {
  return COMPUTER_ACTIONS.includes(capabilityKey as ComputerAction);
}

function toComputerDispatchCapabilityKey(
  action: SupportedMcpAction,
): "mcp.shared.call" | "mcp.native.execute" {
  return action === "mcp.native.execute" ? "mcp.native.execute" : "mcp.shared.call";
}

function resolveAction(action: string): ResolvedMcpAction | undefined {
  if (MCP_SHARED_ACTIONS.includes(action as McpSharedAction)) {
    return {
      dispatchAction: action as McpSharedAction,
      publicCapabilityKey: action as McpSharedAction,
    };
  }
  if (MCP_NATIVE_ACTIONS.includes(action as McpNativeAction)) {
    return {
      dispatchAction: action as McpNativeAction,
      publicCapabilityKey: action as McpNativeAction,
    };
  }
  switch (action) {
    case "mcp.call":
      return {
        dispatchAction: "mcp.shared.call",
        publicCapabilityKey: "mcp.shared.call",
        compatibilityAlias: "mcp.call",
      };
    case "mcp.listTools":
      return {
        dispatchAction: "mcp.shared.listTools",
        publicCapabilityKey: "mcp.shared.listTools",
        compatibilityAlias: "mcp.listTools",
      };
    case "mcp.readResource":
      return {
        dispatchAction: "mcp.shared.readResource",
        publicCapabilityKey: "mcp.shared.readResource",
        compatibilityAlias: "mcp.readResource",
      };
    case "computer.use":
    case "computer.observe":
    case "computer.act":
      return {
        dispatchAction: "mcp.shared.call",
        publicCapabilityKey: action,
      };
    default:
      return undefined;
  }
}

function isSupportedAction(action: string): action is SupportedMcpKey {
  return resolveAction(action) !== undefined;
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

function parseCallInput(input: Record<string, unknown>): McpCallInput {
  const payload = asObject(input.input);
  const connectionId = asString(payload?.connectionId);
  const toolName = asString(payload?.toolName);
  if (!connectionId) {
    throw new Error("MCP call input is missing connectionId.");
  }
  if (!toolName) {
    throw new Error("MCP call input is missing toolName.");
  }
  return {
    connectionId,
    toolName,
    arguments: asObject(payload?.arguments),
  };
}

function parseListToolsInput(input: Record<string, unknown>): McpListToolsInput {
  const payload = asObject(input.input);
  const connectionId = asString(payload?.connectionId);
  if (!connectionId) {
    throw new Error("MCP listTools input is missing connectionId.");
  }
  return { connectionId };
}

function parseReadResourceInput(input: Record<string, unknown>): McpReadResourceInput {
  const payload = asObject(input.input);
  const connectionId = asString(payload?.connectionId);
  const uri = asString(payload?.uri);
  if (!connectionId) {
    throw new Error("MCP readResource input is missing connectionId.");
  }
  if (!uri) {
    throw new Error("MCP readResource input is missing uri.");
  }
  return { connectionId, uri };
}

function parseNativeExecuteInput(input: Record<string, unknown>): McpConnectInput {
  const payload = asObject(input.input);
  const transport = asObject(payload?.transport);
  const kind = asString(transport?.kind);
  if (!kind || (kind !== "stdio" && kind !== "streamable-http" && kind !== "in-memory")) {
    throw new Error("MCP native.execute input is missing a supported transport.kind.");
  }

  return payload as unknown as McpConnectInput;
}

function parsePreparedPayload(actionKey: string, input: Record<string, unknown>): SupportedMcpPreparedPayload {
  const resolvedAction = resolveAction(actionKey);
  if (!resolvedAction) {
    throw new Error(`Unsupported MCP capability action: ${actionKey}.`);
  }
  const route = parseRouteSelection(input);
  switch (resolvedAction.dispatchAction) {
    case "mcp.shared.call":
      return {
        action: resolvedAction.dispatchAction,
        requestedCapabilityKey: actionKey,
        publicCapabilityKey: resolvedAction.publicCapabilityKey,
        compatibilityAlias: resolvedAction.compatibilityAlias,
        route,
        input: parseCallInput(input),
      };
    case "mcp.shared.listTools":
      return {
        action: resolvedAction.dispatchAction,
        requestedCapabilityKey: actionKey,
        publicCapabilityKey: resolvedAction.publicCapabilityKey,
        compatibilityAlias: resolvedAction.compatibilityAlias,
        route,
        input: parseListToolsInput(input),
      };
    case "mcp.shared.readResource":
      return {
        action: resolvedAction.dispatchAction,
        requestedCapabilityKey: actionKey,
        publicCapabilityKey: resolvedAction.publicCapabilityKey,
        compatibilityAlias: resolvedAction.compatibilityAlias,
        route,
        input: parseReadResourceInput(input),
      };
    case "mcp.native.execute":
      return {
        action: resolvedAction.dispatchAction,
        requestedCapabilityKey: actionKey,
        publicCapabilityKey: resolvedAction.publicCapabilityKey,
        compatibilityAlias: resolvedAction.compatibilityAlias,
        route,
        input: parseNativeExecuteInput(input),
      };
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

function createExecutionMetadata(
  payload: SupportedMcpPreparedPayload,
  route: McpRouteSelection,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const alias = payload.compatibilityAlias
    ? { capabilityAlias: payload.compatibilityAlias }
    : undefined;
  const capabilityPackage = isComputerCapabilityKey(payload.publicCapabilityKey)
    ? summarizeCapabilityPackage(
        createRaxComputerCapabilityPackage({
          capabilityKey: payload.publicCapabilityKey,
          route,
          input: payload.input as McpCallInput,
          dispatchCapabilityKey: toComputerDispatchCapabilityKey(payload.action),
        }),
      )
    : summarizeCapabilityPackage(
        createRaxMcpCapabilityPackage({
          capabilityKey: payload.action,
          route,
          input: payload.input as McpCallInput | McpListToolsInput | McpReadResourceInput | McpConnectInput,
          originalCapabilityKey: payload.compatibilityAlias,
          nativePlan: payload.nativePlan,
        }),
      );
  return {
    capability: payload.publicCapabilityKey,
    dispatchCapability: payload.action,
    provider: route.provider,
    model: route.model,
    layer: route.layer,
    capabilityPackage,
    ...extra,
    ...alias,
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

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    if (!this.supports(plan)) {
      throw new Error(`Unsupported MCP capability action: ${plan.capabilityKey}.`);
    }

    const parsed = parsePreparedPayload(plan.capabilityKey, plan.input);

    let preparedPayload: SupportedMcpPreparedPayload;
    if (parsed.action === "mcp.native.execute") {
      const nativePlan = this.#facade.mcp.native.prepare({
        provider: parsed.route.provider,
        model: parsed.route.model,
        layer: parsed.route.layer,
        variant: parsed.route.variant,
        compatibilityProfileId: parsed.route.compatibilityProfileId,
        input: parsed.input as McpConnectInput,
      });
      const invocation = this.#facade.mcp.native.build({
        provider: parsed.route.provider,
        model: parsed.route.model,
        layer: parsed.route.layer,
        variant: parsed.route.variant,
        compatibilityProfileId: parsed.route.compatibilityProfileId,
        input: parsed.input as McpConnectInput,
      });
      preparedPayload = { ...parsed, nativePlan, invocation };
    } else {
      preparedPayload = parsed;
    }

    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: parsed.action === "mcp.native.execute" ? "long-running" : "direct",
      preparedPayloadRef: `${this.id}:${plan.planId}`,
      cacheKey: plan.idempotencyKey,
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
        case "mcp.shared.call":
          return this.#executeCall(
            prepared.preparedId,
            payload.route,
            payload.input as McpCallInput,
            payload.requestedCapabilityKey,
          );
        case "mcp.shared.listTools":
          return this.#executeListTools(
            prepared.preparedId,
            payload.route,
            payload.input as McpListToolsInput,
            payload.requestedCapabilityKey,
          );
        case "mcp.shared.readResource":
          return this.#executeReadResource(
            prepared.preparedId,
            payload.route,
            payload.input as McpReadResourceInput,
            payload.requestedCapabilityKey,
          );
        case "mcp.native.execute":
          return this.#executeNative(
            prepared.preparedId,
            payload.route,
            payload.input as McpConnectInput,
            payload.invocation as Awaited<ReturnType<RaxFacade["mcp"]["native"]["build"]>>,
            payload.nativePlan,
            payload.requestedCapabilityKey,
          );
      }
    } catch (error) {
      return createFailureEnvelope({
        executionId: prepared.preparedId,
        code: "rax_mcp_execute_failed",
        error,
        metadata: createExecutionMetadata(payload, payload.route),
      });
    }
  }

  async #executeCall(
    executionId: string,
    route: McpRouteSelection,
    input: McpCallInput,
    originalAction?: string,
  ): Promise<CapabilityResultEnvelope> {
    const payload: SupportedMcpPreparedPayload = {
      action: "mcp.shared.call",
      requestedCapabilityKey: originalAction ?? "mcp.shared.call",
      publicCapabilityKey: originalAction === "computer.use" ||
          originalAction === "computer.observe" ||
          originalAction === "computer.act"
        ? originalAction
        : "mcp.shared.call",
      compatibilityAlias:
        originalAction === "mcp.call" ? "mcp.call" : undefined,
      route,
      input,
    };
    const result = await this.#facade.mcp.shared.call({
      provider: route.provider,
      model: route.model,
      layer: route.layer,
      variant: route.variant,
      compatibilityProfileId: route.compatibilityProfileId,
      input,
    });

    return createCapabilityResultEnvelope({
      executionId,
      status: this.#resultStatusFromCallResult(result),
      output: result,
      metadata: createExecutionMetadata(payload, route, {
        connectionId: input.connectionId,
        toolName: input.toolName,
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
    originalAction?: string,
  ): Promise<CapabilityResultEnvelope> {
    const payload: SupportedMcpPreparedPayload = {
      action: "mcp.shared.listTools",
      requestedCapabilityKey: originalAction ?? "mcp.shared.listTools",
      publicCapabilityKey: "mcp.shared.listTools",
      compatibilityAlias:
        originalAction === "mcp.listTools" ? "mcp.listTools" : undefined,
      route,
      input,
    };
    const result = await this.#facade.mcp.shared.listTools({
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
      metadata: createExecutionMetadata(payload, route, {
        connectionId: input.connectionId,
        toolCount: result.tools.length,
      }),
    });
  }

  async #executeReadResource(
    executionId: string,
    route: McpRouteSelection,
    input: McpReadResourceInput,
    originalAction?: string,
  ): Promise<CapabilityResultEnvelope> {
    const payload: SupportedMcpPreparedPayload = {
      action: "mcp.shared.readResource",
      requestedCapabilityKey: originalAction ?? "mcp.shared.readResource",
      publicCapabilityKey: "mcp.shared.readResource",
      compatibilityAlias:
        originalAction === "mcp.readResource" ? "mcp.readResource" : undefined,
      route,
      input,
    };
    const result = await this.#facade.mcp.shared.readResource({
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
      metadata: createExecutionMetadata(payload, route, {
        connectionId: input.connectionId,
        uri: input.uri,
      }),
    });
  }

  async #executeNative(
    executionId: string,
    route: McpRouteSelection,
    input: McpConnectInput,
    invocation: Awaited<ReturnType<RaxFacade["mcp"]["native"]["build"]>>,
    nativePlan: ReturnType<RaxFacade["mcp"]["native"]["prepare"]> | undefined,
    originalAction?: string,
  ): Promise<CapabilityResultEnvelope> {
    const payload: SupportedMcpPreparedPayload = {
      action: "mcp.native.execute",
      requestedCapabilityKey: originalAction ?? "mcp.native.execute",
      publicCapabilityKey: "mcp.native.execute",
      route,
      input,
      nativePlan,
      invocation,
    };
    const result = await this.#facade.mcp.native.execute(invocation);
    return createCapabilityResultEnvelope({
      executionId,
      status: "success",
      output: result,
      metadata: createExecutionMetadata(payload, route, {
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
