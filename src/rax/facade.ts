import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

import type { FacadeCallOptions, PreparedInvocation } from "./contracts.js";
import { applyCompatibilityProfile, getCompatibilityProfile, type CompatibilityProfile } from "./compatibility.js";
import { RaxRoutingError } from "./errors.js";
import {
  buildAnthropicSkillCreatePayload,
  buildAnthropicSkillDeletePayload,
  buildAnthropicSkillListPayload,
  buildAnthropicSkillRetrievePayload,
  buildAnthropicSkillUploadBundle,
  buildAnthropicSkillVersionCreatePayload,
  buildAnthropicSkillVersionDeletePayload,
  buildAnthropicSkillVersionListPayload,
  buildAnthropicSkillVersionRetrievePayload
} from "../integrations/anthropic/api/tools/skills/lifecycle.js";
import {
  buildOpenAISkillContentRetrievePayload,
  buildOpenAISkillDeletePayload,
  buildOpenAISkillListPayload,
  buildOpenAISkillRetrievePayload,
  buildOpenAISkillUpdatePayload,
  buildOpenAISkillVersionContentRetrievePayload,
  buildOpenAISkillVersionDeletePayload,
  buildOpenAISkillVersionListPayload,
  buildOpenAISkillVersionRetrievePayload
} from "../integrations/openai/api/tools/skills/lifecycle.js";
import {
  buildOpenAISkillCreatePlan,
  buildOpenAISkillLocalDirectoryBundle,
  buildOpenAISkillVersionCreatePlan
} from "../integrations/openai/api/tools/skills/managed.js";
import { composeNativeMcpInvocation } from "./mcp-native-compose.js";
import { McpNativeRuntime, type McpNativeRuntimeLike } from "./mcp-native-runtime.js";
import { McpRuntime } from "./mcp-runtime.js";
import { buildAnthropicApiNativeMcpPayload } from "../integrations/anthropic/api/mcp.js";
import { buildAnthropicAgentNativeMcpPayload } from "../integrations/anthropic/agent/mcp.js";
import { buildDeepMindApiNativeMcpPayload } from "../integrations/deepmind/api/mcp.js";
import { buildDeepMindAgentNativeMcpPayload } from "../integrations/deepmind/agent/mcp.js";
import { buildOpenAIApiNativeMcpPayload } from "../integrations/openai/api/mcp.js";
import { buildOpenAIAgentNativeMcpPayload } from "../integrations/openai/agent/mcp.js";
import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import type {
  McpCallInput,
  McpCallResult,
  McpConnectionSummary,
  McpConnectInput,
  McpGetPromptInput,
  McpGetPromptResult,
  McpNativePrepareResult,
  McpListToolsInput,
  McpListPromptsInput,
  McpListPromptsResult,
  McpListResourcesInput,
  McpListResourcesResult,
  McpListToolsResult,
  McpServeInput,
  McpServeResult,
  McpSessionHandle,
  McpReadResourceInput,
  McpReadResourceResult
} from "./mcp-types.js";
import { getCapabilityDefinition } from "./registry.js";
import { createCapabilityRequest, type CapabilityRouter } from "./router.js";
import { SkillRuntime } from "./skill-runtime.js";
import type {
  SkillActivateInput,
  SkillActivationPlan,
  SkillBindingMode,
  SkillBindInput,
  SkillContainer,
  SkillContainerCreateInput,
  SkillDefineInput,
  SkillDescriptor,
  SkillDiscoverInput,
  SkillLoadLocalInput,
  SkillLocalPackage,
  SkillManagedGetInput,
  SkillManagedContentGetInput,
  SkillManagedListInput,
  SkillManagedPublishInput,
  SkillManagedRemoveInput,
  SkillMountInput,
  SkillMountResult,
  SkillSetDefaultVersionInput,
  SkillUseInput,
  SkillUseResult,
  SkillVersionGetInput,
  SkillVersionContentGetInput,
  SkillVersionListInput,
  SkillVersionPublishInput,
  SkillVersionRemoveInput
} from "./skill-types.js";
import type { CapabilityResult } from "./types.js";
import type { WebSearchCreateInput } from "./websearch-types.js";
import type { WebSearchOutput } from "./websearch-types.js";
import { WebSearchRuntime, type WebSearchRuntimeLike } from "./websearch-runtime.js";

export interface RaxFacade {
  generate: {
    create<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
    stream<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  embed: {
    create<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  file: {
    upload<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  batch: {
    submit<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  websearch: {
    create(
      options: FacadeCallOptions<WebSearchCreateInput>
    ): Promise<CapabilityResult<WebSearchOutput>>;
    prepare<TPayload = unknown>(
      options: FacadeCallOptions<WebSearchCreateInput>
    ): PreparedInvocation<TPayload>;
  };
  mcp: {
    shared: {
      use(options: FacadeCallOptions<McpConnectInput>): Promise<McpSessionHandle>;
      connect(options: FacadeCallOptions<McpConnectInput>): Promise<McpConnectionSummary>;
      listConnections(options: FacadeCallOptions<Record<string, never>>): McpConnectionSummary[];
      disconnect(options: FacadeCallOptions<{ connectionId: string }>): Promise<void>;
      disconnectAll(options: FacadeCallOptions<Record<string, never>>): Promise<void>;
      listTools(options: FacadeCallOptions<McpListToolsInput>): Promise<McpListToolsResult>;
      listResources(options: FacadeCallOptions<McpListResourcesInput>): Promise<McpListResourcesResult>;
      readResource(options: FacadeCallOptions<McpReadResourceInput>): Promise<McpReadResourceResult>;
      listPrompts(options: FacadeCallOptions<McpListPromptsInput>): Promise<McpListPromptsResult>;
      getPrompt(options: FacadeCallOptions<McpGetPromptInput>): Promise<McpGetPromptResult>;
      call(options: FacadeCallOptions<McpCallInput>): Promise<McpCallResult>;
    };
    native: {
      prepare(options: FacadeCallOptions<McpConnectInput>): McpNativePrepareResult;
      serve(options: FacadeCallOptions<McpServeInput>): McpServeResult;
      build(options: FacadeCallOptions<McpConnectInput>): PreparedInvocation<Record<string, unknown>>;
      compose<TPayload extends Record<string, unknown>>(
        base: PreparedInvocation<TPayload>,
        nativeInvocations: PreparedInvocation<Record<string, unknown>> | Array<PreparedInvocation<Record<string, unknown>>>
      ): PreparedInvocation<TPayload>;
      execute(invocation: PreparedInvocation<Record<string, unknown>>): Promise<unknown>;
      composeAndExecute<TPayload extends Record<string, unknown>>(
        base: PreparedInvocation<TPayload>,
        nativeInvocations: PreparedInvocation<Record<string, unknown>> | Array<PreparedInvocation<Record<string, unknown>>>
      ): Promise<unknown>;
    };
    use(options: FacadeCallOptions<McpConnectInput>): Promise<McpSessionHandle>;
    connect(options: FacadeCallOptions<McpConnectInput>): Promise<McpConnectionSummary>;
    listConnections(options: FacadeCallOptions<Record<string, never>>): McpConnectionSummary[];
    disconnect(options: FacadeCallOptions<{ connectionId: string }>): Promise<void>;
    disconnectAll(options: FacadeCallOptions<Record<string, never>>): Promise<void>;
    listTools(options: FacadeCallOptions<McpListToolsInput>): Promise<McpListToolsResult>;
    listResources(options: FacadeCallOptions<McpListResourcesInput>): Promise<McpListResourcesResult>;
    readResource(options: FacadeCallOptions<McpReadResourceInput>): Promise<McpReadResourceResult>;
    listPrompts(options: FacadeCallOptions<McpListPromptsInput>): Promise<McpListPromptsResult>;
    getPrompt(options: FacadeCallOptions<McpGetPromptInput>): Promise<McpGetPromptResult>;
    call(options: FacadeCallOptions<McpCallInput>): Promise<McpCallResult>;
    serve(options: FacadeCallOptions<McpServeInput>): McpServeResult;
  };
  skill: {
    loadLocal(input: SkillLoadLocalInput): Promise<SkillLocalPackage>;
    define(input: SkillDefineInput): SkillContainer;
    containerCreate(input: SkillContainerCreateInput): Promise<SkillContainer>;
    discover(input: SkillDiscoverInput): Promise<SkillDescriptor[]>;
    bind(input: SkillBindInput): SkillContainer;
    activate(input: SkillActivateInput): { container: SkillContainer; plan: SkillActivationPlan };
    prepare(
      options: FacadeCallOptions<{
        container: SkillContainer;
        includeResources?: boolean;
        includeHelpers?: boolean;
      }>
    ): PreparedInvocation<Record<string, unknown>>;
    mount(
      options: FacadeCallOptions<SkillMountInput>
    ): SkillMountResult;
    compose<TPayload extends Record<string, unknown>>(
      base: PreparedInvocation<TPayload>,
      skill:
        | PreparedInvocation<Record<string, unknown>>
        | SkillMountResult
        | SkillUseResult
    ): PreparedInvocation<TPayload>;
    use(options: FacadeCallOptions<SkillUseInput>): Promise<SkillUseResult>;
    list(options: FacadeCallOptions<SkillManagedListInput>): PreparedInvocation<Record<string, unknown>>;
    get(options: FacadeCallOptions<SkillManagedGetInput>): PreparedInvocation<Record<string, unknown>>;
    getContent(options: FacadeCallOptions<SkillManagedContentGetInput>): PreparedInvocation<Record<string, unknown>>;
    publish(options: FacadeCallOptions<SkillManagedPublishInput>): Promise<PreparedInvocation<Record<string, unknown>>>;
    remove(options: FacadeCallOptions<SkillManagedRemoveInput>): PreparedInvocation<Record<string, unknown>>;
    listVersions(options: FacadeCallOptions<SkillVersionListInput>): PreparedInvocation<Record<string, unknown>>;
    getVersion(options: FacadeCallOptions<SkillVersionGetInput>): PreparedInvocation<Record<string, unknown>>;
    getVersionContent(options: FacadeCallOptions<SkillVersionContentGetInput>): PreparedInvocation<Record<string, unknown>>;
    publishVersion(options: FacadeCallOptions<SkillVersionPublishInput>): Promise<PreparedInvocation<Record<string, unknown>>>;
    removeVersion(options: FacadeCallOptions<SkillVersionRemoveInput>): PreparedInvocation<Record<string, unknown>>;
    setDefaultVersion(options: FacadeCallOptions<SkillSetDefaultVersionInput>): PreparedInvocation<Record<string, unknown>>;
  };
}

export function createRaxFacade(
  router: CapabilityRouter,
  profiles?: readonly CompatibilityProfile[],
  mcpRuntime = new McpRuntime(),
  webSearchRuntime: WebSearchRuntimeLike = new WebSearchRuntime(),
  skillRuntime = new SkillRuntime(),
  mcpNativeRuntime: McpNativeRuntimeLike = new McpNativeRuntime()
): RaxFacade {
  return createConfiguredRaxFacade(router, profiles, mcpRuntime, webSearchRuntime, skillRuntime, mcpNativeRuntime);
}

export function createConfiguredRaxFacade(
  router: CapabilityRouter,
  profiles?: readonly CompatibilityProfile[],
  mcpRuntime = new McpRuntime(),
  webSearchRuntime: WebSearchRuntimeLike = new WebSearchRuntime(),
  skillRuntime = new SkillRuntime(),
  mcpNativeRuntime: McpNativeRuntimeLike = new McpNativeRuntime()
): RaxFacade {
  function prepare<TInput = unknown, TPayload = unknown>(
    capability: "generate" | "embed" | "file" | "batch" | "search",
    action: "create" | "stream" | "upload" | "submit" | "ground",
    options: FacadeCallOptions<TInput>
  ): PreparedInvocation<TPayload> {
    const request = createCapabilityRequest(capability, action, options);
    const normalized = profiles
      ? applyCompatibilityProfile(request, profiles)
      : request;
    return router.prepare(normalized);
  }

  function resolveSkillInvocation(
    skill:
      | PreparedInvocation<Record<string, unknown>>
      | SkillMountResult
      | SkillUseResult
  ): PreparedInvocation<Record<string, unknown>> {
    if ("invocation" in skill) {
      return skill.invocation;
    }

    return skill;
  }

  function getSkillComposeContract(
    skill:
      | PreparedInvocation<Record<string, unknown>>
      | SkillMountResult
      | SkillUseResult
  ): {
    strategy: "payload-merge" | "runtime-only";
    reason?: string;
  } {
    if ("activation" in skill) {
      return {
        strategy: skill.activation.composeStrategy ?? "runtime-only",
        reason: skill.activation.composeNotes
      };
    }

    if (skill.sdk.packageName === "openai" && skill.sdk.entrypoint === "client.responses.create") {
      return {
        strategy: "payload-merge",
        reason: "Prepared OpenAI shell carriers can currently be merged into Responses requests."
      };
    }

    if (skill.sdk.packageName === "@anthropic-ai/sdk" && skill.sdk.entrypoint === "client.messages.create") {
      return {
        strategy: "payload-merge",
        reason: "Prepared Anthropic API-managed carriers can currently be merged into Messages requests."
      };
    }

    if (skill.sdk.packageName === "@anthropic-ai/claude-agent-sdk") {
      return {
        strategy: "runtime-only",
        reason: "Anthropic filesystem skill carriers currently require the SDK runtime path instead of payload-merge composition."
      };
    }

    if (skill.sdk.packageName === "@google/adk") {
      return {
        strategy: "runtime-only",
        reason: "Google ADK skill carriers currently require an ADK runtime path instead of payload-merge composition."
      };
    }

    return {
      strategy: "runtime-only",
      reason: "This skill carrier does not currently advertise payload-merge composition."
    };
  }

  function uniqueValues<T>(values: T[]): T[] {
    return [...new Set(values)];
  }

  function composeSkillInvocation<TPayload extends Record<string, unknown>>(
    base: PreparedInvocation<TPayload>,
    skill:
      | PreparedInvocation<Record<string, unknown>>
      | SkillMountResult
      | SkillUseResult
  ): PreparedInvocation<TPayload> {
    const composeContract = getSkillComposeContract(skill);
    if (composeContract.strategy !== "payload-merge") {
      throw new RaxRoutingError(
        "skill_compose_unsupported",
        composeContract.reason ?? "This skill carrier currently requires a runtime-backed execution path instead of payload-merge composition."
      );
    }

    const skillInvocation = resolveSkillInvocation(skill);

    if (base.provider !== skillInvocation.provider) {
      throw new RaxRoutingError(
        "skill_compose_provider_mismatch",
        `Cannot compose ${skillInvocation.provider} skill payload into ${base.provider} generation invocation.`
      );
    }

    if (base.provider === "openai") {
      const basePayload = base.payload as unknown as OpenAIInvocationPayload<Record<string, unknown> & {
        params?: Record<string, unknown> & { tools?: Array<Record<string, unknown>> };
      }>;
      const skillPayload = skillInvocation.payload as {
        tools?: Array<Record<string, unknown>>;
      };

      if (base.sdk.packageName !== "openai" || basePayload.surface !== "responses") {
        throw new RaxRoutingError(
          "skill_compose_unsupported",
          "OpenAI skill composition currently only supports Responses API invocations."
        );
      }

      if (skillInvocation.sdk.packageName !== "openai" || skillInvocation.sdk.entrypoint !== "client.responses.create") {
        throw new RaxRoutingError(
          "skill_compose_unsupported",
          "OpenAI skill composition currently only supports skill payloads prepared for Responses API execution."
        );
      }

      const mergedPayload = {
        ...basePayload,
        params: {
          ...(basePayload.params ?? {}),
          tools: [
            ...(((basePayload.params as { tools?: Array<Record<string, unknown>> } | undefined)?.tools) ?? []),
            ...(skillPayload.tools ?? [])
          ]
        }
      } as unknown as TPayload;

      return {
        ...base,
        payload: mergedPayload,
        sdk: {
          ...base.sdk,
          notes: [base.sdk.notes, "Composed with prepared OpenAI skill carrier payload."].filter(Boolean).join(" ")
        }
      };
    }

    if (base.provider === "anthropic") {
      if (base.sdk.packageName !== "@anthropic-ai/sdk" || base.sdk.entrypoint !== "client.messages.create") {
        throw new RaxRoutingError(
          "skill_compose_unsupported",
          "Anthropic skill composition currently only supports Messages API invocations."
        );
      }

      if (skillInvocation.sdk.packageName !== "@anthropic-ai/sdk" || skillInvocation.sdk.entrypoint !== "client.messages.create") {
        throw new RaxRoutingError(
          "skill_compose_unsupported",
          "Anthropic skill composition currently only supports API-managed skill payloads prepared for Messages API execution; filesystem skills still require the SDK runtime path."
        );
      }

      const basePayload = base.payload as Record<string, unknown> & {
        tools?: Array<Record<string, unknown>>;
        betas?: string[];
        container?: Record<string, unknown> & {
          skills?: Array<Record<string, unknown>>;
        };
      };
      const skillPayload = skillInvocation.payload as Record<string, unknown> & {
        tools?: Array<Record<string, unknown>>;
        betas?: string[];
        container?: Record<string, unknown> & {
          skills?: Array<Record<string, unknown>>;
        };
      };

      const baseContainer = basePayload.container;
      const skillContainer = skillPayload.container;

      const mergedContainer =
        baseContainer || skillContainer
          ? {
              ...(baseContainer ?? {}),
              ...(skillContainer ?? {}),
              skills: [
                ...((baseContainer?.skills ?? []) as Array<Record<string, unknown>>),
                ...((skillContainer?.skills ?? []) as Array<Record<string, unknown>>)
              ]
            }
          : undefined;

      const mergedPayload = {
        ...basePayload,
        ...(mergedContainer ? { container: mergedContainer } : {}),
        ...(basePayload.betas || skillPayload.betas
          ? { betas: uniqueValues([...(basePayload.betas ?? []), ...(skillPayload.betas ?? [])]) }
          : {}),
        ...(basePayload.tools || skillPayload.tools
          ? { tools: [...(basePayload.tools ?? []), ...(skillPayload.tools ?? [])] }
          : {})
      } as unknown as TPayload;

      return {
        ...base,
        payload: mergedPayload,
        sdk: {
          ...base.sdk,
          notes: [base.sdk.notes, "Composed with prepared Anthropic skill carrier payload."].filter(Boolean).join(" ")
        }
      };
    }

    throw new RaxRoutingError(
      "skill_compose_unsupported",
      base.provider === "deepmind"
        ? "Google ADK skill carriers currently require an ADK runtime path instead of payload-merge composition."
        : `Skill composition is not implemented for provider ${base.provider}.`
    );
  }

  function normalizeMcpRequest<TInput>(
    action:
      | "connect"
      | "serve"
      | "listConnections"
      | "disconnect"
      | "disconnectAll"
      | "listTools"
      | "listResources"
      | "readResource"
      | "listPrompts"
      | "getPrompt"
      | "call",
    options: FacadeCallOptions<TInput>
  ) {
    const request = createCapabilityRequest("mcp", action, options);
    return profiles ? applyCompatibilityProfile(request, profiles) : request;
  }

  function normalizeSkillRequest<TInput>(
    action: "define" | "discover" | "bind" | "activate" | "use" | "load" | "list" | "read" | "create" | "update" | "remove",
    options: FacadeCallOptions<TInput>
  ) {
    const request = createCapabilityRequest("skill", action, options);
    return profiles ? applyCompatibilityProfile(request, profiles) : request;
  }

  function resolveSkillUseMode(
    provider: FacadeCallOptions["provider"],
    input: SkillUseInput
  ): SkillBindingMode | undefined {
    if ("mode" in input && input.mode !== undefined) {
      return input.mode;
    }

    if (!("reference" in input)) {
      return undefined;
    }

    switch (provider) {
      case "openai":
        return "openai-hosted-shell";
      case "anthropic":
        return "anthropic-api-managed";
      case "deepmind":
        throw new RaxRoutingError(
          "skill_reference_mode_required",
          "DeepMind reference-first skill.use currently requires an explicit mode; hosted registry-style references are not assumed in the current baseline."
        );
    }
  }

  function resolveSkillUseDetails(
    provider: FacadeCallOptions["provider"],
    mode: SkillBindingMode | undefined,
    input: SkillUseInput
  ): SkillUseInput["details"] {
    const existingDetails =
      "details" in input && input.details
        ? { ...input.details }
        : undefined;

    if (!("reference" in input)) {
      return existingDetails;
    }

    if (mode === undefined) {
      return existingDetails;
    }

    switch (mode) {
      case "openai-hosted-shell":
        return {
          skill_id: input.reference.id,
          ...(input.reference.version === undefined ? {} : { attach_version: input.reference.version }),
          ...(existingDetails ?? {})
        };
      case "anthropic-api-managed":
        return {
          skill_id: input.reference.id,
          ...(input.reference.version === undefined ? {} : { version: input.reference.version }),
          ...(existingDetails ?? {})
        };
      case "openai-local-shell":
      case "openai-inline-shell":
      case "anthropic-sdk-filesystem":
      case "google-adk-local":
      case "google-adk-code-defined":
        throw new RaxRoutingError(
          "skill_reference_mode_unsupported",
          `skill.use reference input is not supported for mode ${mode}; use source/container input for local carriers or pick a managed/hosted mode.`
        );
    }
  }

  async function resolveSkillUseContainer(
    input: SkillUseInput
  ): Promise<SkillContainer> {
    if ("container" in input) {
      return input.container;
    }

    if ("reference" in input) {
      return skillRuntime.containerCreateFromReference({
        reference: input.reference,
        policy: input.policy,
        loading: input.loading
      });
    }

    return skillRuntime.containerCreate({
      source: input.source,
      descriptor: input.descriptor,
      policy: input.policy,
      loading: input.loading
    });
  }

  function createMcpSessionHandle(
    route: {
      provider: FacadeCallOptions["provider"];
      model: string;
      compatibilityProfileId?: string;
    },
    connection: McpConnectionSummary
  ): McpSessionHandle {
    const sessionRoute = {
      provider: route.provider,
      model: route.model,
      layer: connection.layer,
      compatibilityProfileId: route.compatibilityProfileId
    } as const;

    return {
      connection,
      tools: () =>
        mcpRuntime.listTools({
          ...sessionRoute,
          input: { connectionId: connection.connectionId }
        }),
      resources: () =>
        mcpRuntime.listResources({
          ...sessionRoute,
          input: { connectionId: connection.connectionId }
        }),
      read: (input) =>
        mcpRuntime.readResource({
          ...sessionRoute,
          input: {
            connectionId: connection.connectionId,
            uri: input.uri
          }
        }),
      prompts: () =>
        mcpRuntime.listPrompts({
          ...sessionRoute,
          input: { connectionId: connection.connectionId }
        }),
      prompt: (input) =>
        mcpRuntime.getPrompt({
          ...sessionRoute,
          input: {
            connectionId: connection.connectionId,
            name: input.name,
            arguments: input.arguments
          }
        }),
      call: (input) =>
        mcpRuntime.call({
          ...sessionRoute,
          input: {
            connectionId: connection.connectionId,
            toolName: input.toolName,
            arguments: input.arguments
          }
        }),
      disconnect: () =>
        mcpRuntime.disconnect({
          ...sessionRoute,
          connectionId: connection.connectionId
        })
    };
  }

  function assertMcpSharedExecutionAllowed(
    options: FacadeCallOptions<McpConnectInput>
  ): void {
    if (options.input.strategy !== "provider-native") {
      return;
    }

    const nativePlan = prepareNativeMcpPlan(options);
    throw new RaxRoutingError(
      "mcp_native_execution_unimplemented",
      [
        `Native MCP execution is not implemented for ${nativePlan.provider} ${nativePlan.officialCarrier}.`,
        `Use rax.mcp.native.prepare(...) to inspect the official carrier plan first.`,
        ...nativePlan.notes
      ].join(" ")
    );
  }

  function prepareNativeMcpPlan(
    options: FacadeCallOptions<McpConnectInput>
  ): McpNativePrepareResult {
    const normalized = normalizeMcpRequest("connect", options);
    const shell = mcpRuntime.getProviderShell(
      normalized.provider,
      normalized.layer,
      normalized.input.transport.kind
    );

    const nativeLoweringMode =
      shell.layer === "api" ? "provider-native-api" : "provider-native-agent";
    const nativeSupportedTransports = shell.nativeSupportedTransports ?? [];
    const supported = nativeSupportedTransports.includes(normalized.input.transport.kind);
    const profile = getCompatibilityProfile(
      normalized.provider,
      profiles,
      normalized.compatibilityProfileId
    );
    const profileMcp = profile.mcp?.[shell.layer];
    const builderId = `${normalized.provider}.${shell.layer}.${shell.officialCarrier}` as const;
    const nativePayload = (() => {
      if (!supported) {
        return undefined;
      }

      if (shell.layer === "agent") {
        switch (normalized.provider) {
          case "openai":
            return buildOpenAIAgentNativeMcpPayload(normalized.input.transport);
          case "anthropic":
            return buildAnthropicAgentNativeMcpPayload(normalized.input.transport);
          case "deepmind":
            return buildDeepMindAgentNativeMcpPayload(normalized.input.transport);
        }
      }

      switch (normalized.provider) {
        case "openai":
          return buildOpenAIApiNativeMcpPayload(
            normalized.input.transport,
            normalized.input.connectionId ?? "rax-openai-mcp"
          );
        case "anthropic":
          return buildAnthropicApiNativeMcpPayload(
            normalized.input.transport,
            normalized.input.connectionId ?? "rax-anthropic-mcp"
          );
        case "deepmind":
          return buildDeepMindApiNativeMcpPayload(normalized.input.transport);
      }
    })();

    return {
      provider: normalized.provider,
      model: normalized.model,
      layer: shell.layer,
      shellId: shell.id,
      builderId,
      officialCarrier: shell.officialCarrier,
      carrierKind: "provider-native",
      loweringMode: nativeLoweringMode,
      transportKind: normalized.input.transport.kind,
      supported,
      unsupportedReasons: supported
        ? undefined
        : [
            `transport ${normalized.input.transport.kind} is not supported by the official ${shell.officialCarrier} native carrier`
          ],
      constraintSnapshot: {
        nativeSupportedTransports,
        supportedModelHints: profileMcp?.supportedModelHints,
        supportsResources: shell.nativeSupportsResources ?? false,
        supportsPrompts: shell.nativeSupportsPrompts ?? false,
        supportsServe: shell.nativeSupportsServe ?? false
      },
      supportsResources: shell.nativeSupportsResources ?? false,
      supportsPrompts: shell.nativeSupportsPrompts ?? false,
      supportsServe: shell.nativeSupportsServe ?? false,
      sdkPackageName: nativePayload?.sdkPackageName,
      entrypoint: nativePayload?.entrypoint,
      payload: nativePayload?.payload,
      notes: supported
        ? [
            ...(shell.notes ?? []),
            `This route can be lowered to the official ${shell.officialCarrier} carrier when provider-native MCP lowering is implemented.`
          ]
        : [
            ...(shell.notes ?? []),
            `The official ${shell.officialCarrier} carrier does not currently accept transport ${normalized.input.transport.kind} in this preparation path.`,
            "Current rax runtime still lowers this MCP route through the shared MCP client runtime."
          ]
    };
  }

  function buildNativeMcpInvocation(
    options: FacadeCallOptions<McpConnectInput>
  ): PreparedInvocation<Record<string, unknown>> {
    const nativePlan = prepareNativeMcpPlan(options);
    if (
      !nativePlan.supported ||
      nativePlan.payload === undefined ||
      nativePlan.sdkPackageName === undefined ||
      nativePlan.entrypoint === undefined
    ) {
      throw new RaxRoutingError(
        "mcp_native_build_unsupported",
        [
          `Native MCP build is not available for ${nativePlan.provider} ${nativePlan.officialCarrier}.`,
          ...(nativePlan.unsupportedReasons ?? nativePlan.notes)
        ].join(" ")
      );
    }

    return {
      key: "mcp.connect",
      provider: nativePlan.provider,
      model: nativePlan.model,
      layer: nativePlan.layer,
      variant: "provider-native",
      adapterId: `mcp.native.${nativePlan.builderId}`,
      sdk: {
        packageName: nativePlan.sdkPackageName,
        entrypoint: nativePlan.entrypoint,
        notes: nativePlan.notes.join(" ")
      },
      payload: nativePlan.payload as unknown as Record<string, unknown>
    };
  }

  function prepareMcpServePlan(
    options: FacadeCallOptions<McpServeInput>
  ): McpServeResult {
    const normalized = normalizeMcpRequest("serve", options);
    const definition = getCapabilityDefinition("mcp.serve");
    const preferredLayer =
      normalized.layer === undefined || normalized.layer === "auto"
        ? definition?.providerSupport[normalized.provider].preferredLayer
        : normalized.layer;
    const shell = mcpRuntime.getProviderShell(normalized.provider, preferredLayer);

    if (normalized.provider === "anthropic" && shell.layer === "agent") {
      const serverConfig = createSdkMcpServer({
        name: normalized.input.serverName,
        version: normalized.input.serverVersion,
        tools: normalized.input.tools as never
      });

      return {
        provider: normalized.provider,
        model: normalized.model,
        layer: shell.layer,
        officialCarrier: shell.officialCarrier,
        supported: true,
        sdk: {
          packageName: "@anthropic-ai/claude-agent-sdk",
          entrypoint: "createSdkMcpServer",
          notes: "Creates an in-process MCP SDK server config for Claude Agent / Claude Code runtime."
        },
        payload: {
          serverConfig
        },
        notes: [
          "Anthropic agent-side MCP serving is exposed through createSdkMcpServer().",
          "This payload is a live SDK server config with an in-process MCP server instance.",
          ...(shell.notes ?? [])
        ]
      };
    }

    if (normalized.provider === "openai") {
      return {
        provider: normalized.provider,
        model: normalized.model,
        layer: shell.layer,
        officialCarrier: shell.officialCarrier,
        supported: false,
        unsupportedReasons: [
          "OpenAI does not expose a first-class MCP server hosting helper in the current JS agent/runtime baseline."
        ],
        notes: shell.notes ?? []
      };
    }

    if (normalized.provider === "deepmind") {
      return {
        provider: normalized.provider,
        model: normalized.model,
        layer: shell.layer,
        officialCarrier: shell.officialCarrier,
        supported: false,
        unsupportedReasons: [
          "Google ADK docs mention MCP exposure, but the current JS baseline used by rax does not expose a single-step MCP server builder comparable to Anthropic createSdkMcpServer()."
        ],
        notes: shell.notes ?? []
      };
    }

    return {
      provider: normalized.provider,
      model: normalized.model,
      layer: shell.layer,
      officialCarrier: shell.officialCarrier,
      supported: false,
      unsupportedReasons: [
        `mcp.serve is not implemented for ${normalized.provider} on layer ${shell.layer}.`
      ],
      notes: shell.notes ?? []
    };
  }

  function prepareSkillInvocation(
    options: FacadeCallOptions<{
      container: SkillContainer;
      includeResources?: boolean;
      includeHelpers?: boolean;
    }>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("activate", options);

    const boundContainer = options.input.container.bindings[options.provider]
      ? options.input.container
      : skillRuntime.bind({
          container: options.input.container,
          provider: options.provider,
          layer: options.layer === undefined || options.layer === "auto" ? undefined : options.layer
        });

    const { plan } = skillRuntime.activate({
      container: boundContainer,
      provider: options.provider,
      includeResources: options.input.includeResources,
      includeHelpers: options.input.includeHelpers
    });

    const sdkSurface = (() => {
      switch (plan.mode) {
        case "openai-local-shell":
        case "openai-inline-shell":
        case "openai-hosted-shell":
          return {
            packageName: "openai",
            entrypoint: "client.responses.create"
          };
        case "anthropic-api-managed":
          return {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.messages.create"
          };
        case "anthropic-sdk-filesystem":
          return {
            packageName: "@anthropic-ai/claude-agent-sdk",
            entrypoint: "agent.create"
          };
        case "google-adk-local":
        case "google-adk-code-defined":
          return {
            packageName: "@google/adk",
            entrypoint: "SkillToolset"
          };
      }
    })();

    const payload = (() => {
      if (
        plan.mode === "openai-local-shell" ||
        plan.mode === "openai-inline-shell" ||
        plan.mode === "openai-hosted-shell"
      ) {
        return {
          model: options.model,
          ...plan.payload
        };
      }

      if (plan.mode === "anthropic-api-managed") {
        return {
          model: options.model,
          max_tokens: 1024,
          ...plan.payload
        };
      }

      return plan.payload;
    })() as unknown as Record<string, unknown>;

    return {
      key: "skill.activate",
      provider: options.provider,
      model: options.model,
      layer: plan.layer ?? (options.layer === undefined || options.layer === "auto" ? "agent" : options.layer),
      adapterId: `skill.${options.provider}.${plan.mode}`,
      sdk: {
        ...sdkSurface,
        notes: `Prepared against the official ${plan.officialCarrier} carrier surface.`
      },
      payload
    };
  }

  async function resolveManagedSkillContainer(
    input: SkillManagedPublishInput | SkillVersionPublishInput
  ): Promise<SkillContainer> {
    if (input.container) {
      return input.container;
    }

    return skillRuntime.containerCreate({
      source: input.source,
      descriptor: input.descriptor,
      policy: input.policy,
      loading: input.loading
    });
  }

  function prepareManagedSkillListInvocation(
    options: FacadeCallOptions<SkillManagedListInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("list", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.list",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.list",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.list"
          },
          payload: buildOpenAISkillListPayload({
            after: options.providerOptions?.openai?.after as string | undefined,
            limit: options.providerOptions?.openai?.limit as number | undefined,
            order: options.input.order
          }) as unknown as Record<string, unknown>
        };
      case "anthropic":
        return {
          key: "skill.list",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.list",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.list"
          },
          payload: buildAnthropicSkillListPayload({
            limit: options.providerOptions?.anthropic?.limit as number | undefined,
            page: options.providerOptions?.anthropic?.page as string | null | undefined,
            source: options.input.source,
            betas: options.providerOptions?.anthropic?.betas as string[] | undefined
          }) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill registry list surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillGetInvocation(
    options: FacadeCallOptions<SkillManagedGetInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("read", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.read",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.get",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.retrieve"
          },
          payload: buildOpenAISkillRetrievePayload(options.input.skillId) as unknown as Record<string, unknown>
        };
      case "anthropic":
        return {
          key: "skill.read",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.get",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.retrieve"
          },
          payload: buildAnthropicSkillRetrievePayload(
            options.input.skillId,
            options.providerOptions?.anthropic?.betas as string[] | undefined
          ) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill registry get surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillContentGetInvocation(
    options: FacadeCallOptions<SkillManagedContentGetInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("read", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.read",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.content.get",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.content.retrieve"
          },
          payload: buildOpenAISkillContentRetrievePayload(
            options.input.skillId
          ) as unknown as Record<string, unknown>
        };
      case "anthropic":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Anthropic beta.skills does not currently document a skill bundle content download surface."
        );
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill content download surface in the current baseline."
        );
    }
  }

  async function prepareManagedSkillPublishInvocation(
    options: FacadeCallOptions<SkillManagedPublishInput>
  ): Promise<PreparedInvocation<Record<string, unknown>>> {
    normalizeSkillRequest("create", options);

    const container = await resolveManagedSkillContainer(options.input);

    switch (options.provider) {
      case "openai":
        {
          const bundle = buildOpenAISkillLocalDirectoryBundle(container.source.rootDir);
          const plan = buildOpenAISkillCreatePlan(bundle);
        return {
          key: "skill.create",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.publish",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.create",
            notes: "Prepared as a directory upload bundle; caller still needs to lower bundle files into SDK Uploadable values."
          },
          payload: plan as unknown as Record<string, unknown>
        };
        }
      case "anthropic":
        return {
          key: "skill.create",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.publish",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.create",
            notes: "Prepared as a directory upload bundle; caller still needs to lower bundle files into SDK Uploadable values."
          },
          payload: buildAnthropicSkillCreatePayload(
            buildAnthropicSkillUploadBundle(container),
            {
              displayTitle: options.input.displayTitle,
              betas: options.providerOptions?.anthropic?.betas as string[] | undefined
            }
          ) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill publish surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillRemoveInvocation(
    options: FacadeCallOptions<SkillManagedRemoveInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("remove", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.remove",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.remove",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.delete"
          },
          payload: buildOpenAISkillDeletePayload(options.input.skillId) as unknown as Record<string, unknown>
        };
      case "anthropic":
        return {
          key: "skill.remove",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.remove",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.delete"
          },
          payload: buildAnthropicSkillDeletePayload(
            options.input.skillId,
            options.providerOptions?.anthropic?.betas as string[] | undefined
          ) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill delete surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillVersionListInvocation(
    options: FacadeCallOptions<SkillVersionListInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("list", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.list",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.versions.list",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.versions.list"
          },
          payload: buildOpenAISkillVersionListPayload(
            options.input.skillId,
            {
              after: options.providerOptions?.openai?.after as string | undefined,
              limit: options.providerOptions?.openai?.limit as number | undefined,
              order: options.input.order
            }
          ) as unknown as Record<string, unknown>
        };
      case "anthropic":
        return {
          key: "skill.list",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.versions.list",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.versions.list"
          },
          payload: buildAnthropicSkillVersionListPayload(options.input.skillId, {
            limit: options.providerOptions?.anthropic?.limit as number | undefined,
            page: options.providerOptions?.anthropic?.page as string | null | undefined,
            betas: options.providerOptions?.anthropic?.betas as string[] | undefined
          }) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill version list surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillVersionGetInvocation(
    options: FacadeCallOptions<SkillVersionGetInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("read", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.read",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.versions.get",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.versions.retrieve"
          },
          payload: buildOpenAISkillVersionRetrievePayload(
            options.input.skillId,
            options.input.version
          ) as unknown as Record<string, unknown>
        };
      case "anthropic":
        return {
          key: "skill.read",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.versions.get",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.versions.retrieve"
          },
          payload: buildAnthropicSkillVersionRetrievePayload(
            options.input.skillId,
            options.input.version,
            options.providerOptions?.anthropic?.betas as string[] | undefined
          ) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill version get surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillVersionContentGetInvocation(
    options: FacadeCallOptions<SkillVersionContentGetInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("read", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.read",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.versions.content.get",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.versions.content.retrieve"
          },
          payload: buildOpenAISkillVersionContentRetrievePayload(
            options.input.skillId,
            options.input.version
          ) as unknown as Record<string, unknown>
        };
      case "anthropic":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Anthropic beta.skills does not currently document a skill version bundle download surface."
        );
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill version content download surface in the current baseline."
        );
    }
  }

  async function prepareManagedSkillVersionPublishInvocation(
    options: FacadeCallOptions<SkillVersionPublishInput>
  ): Promise<PreparedInvocation<Record<string, unknown>>> {
    normalizeSkillRequest("create", options);

    const container = await resolveManagedSkillContainer(options.input);

    switch (options.provider) {
      case "openai":
        {
          const bundle = buildOpenAISkillLocalDirectoryBundle(container.source.rootDir);
          const plan = buildOpenAISkillVersionCreatePlan(
            options.input.skillId,
            bundle,
            options.input.setDefault === undefined
              ? undefined
              : {
                  default: options.input.setDefault
                }
          );
        return {
          key: "skill.create",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.versions.publish",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.versions.create",
            notes: "Prepared as a directory upload bundle; caller still needs to lower bundle files into SDK Uploadable values."
          },
          payload: plan as unknown as Record<string, unknown>
        };
        }
      case "anthropic":
        return {
          key: "skill.create",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.versions.publish",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.versions.create",
            notes: "Prepared as a directory upload bundle; caller still needs to lower bundle files into SDK Uploadable values."
          },
          payload: buildAnthropicSkillVersionCreatePayload(
            options.input.skillId,
            buildAnthropicSkillUploadBundle(container),
            options.providerOptions?.anthropic?.betas as string[] | undefined
          ) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill version publish surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillVersionRemoveInvocation(
    options: FacadeCallOptions<SkillVersionRemoveInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("remove", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.remove",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.versions.remove",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.versions.delete"
          },
          payload: buildOpenAISkillVersionDeletePayload(
            options.input.skillId,
            options.input.version
          ) as unknown as Record<string, unknown>
        };
      case "anthropic":
        return {
          key: "skill.remove",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.anthropic.managed.versions.remove",
          sdk: {
            packageName: "@anthropic-ai/sdk",
            entrypoint: "client.beta.skills.versions.delete"
          },
          payload: buildAnthropicSkillVersionDeletePayload(
            options.input.skillId,
            options.input.version,
            options.providerOptions?.anthropic?.betas as string[] | undefined
          ) as unknown as Record<string, unknown>
        };
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill version delete surface in the current baseline."
        );
    }
  }

  function prepareManagedSkillSetDefaultInvocation(
    options: FacadeCallOptions<SkillSetDefaultVersionInput>
  ): PreparedInvocation<Record<string, unknown>> {
    normalizeSkillRequest("update", options);

    switch (options.provider) {
      case "openai":
        return {
          key: "skill.update",
          provider: options.provider,
          model: options.model,
          layer: "api",
          adapterId: "skill.openai.managed.set-default-version",
          sdk: {
            packageName: "openai",
            entrypoint: "client.skills.update"
          },
          payload: buildOpenAISkillUpdatePayload(
            options.input.skillId,
            options.input.version
          ) as unknown as Record<string, unknown>
        };
      case "anthropic":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Anthropic beta.skills does not document a default-version pointer update surface in the current baseline."
        );
      case "deepmind":
        throw new RaxRoutingError(
          "skill_managed_unsupported",
          "Google ADK does not document a hosted skill default-version update surface in the current baseline."
        );
    }
  }

  async function useSkill(
    options: FacadeCallOptions<SkillUseInput>
  ): Promise<SkillUseResult> {
    normalizeSkillRequest("use", options);

    const container = await resolveSkillUseContainer(options.input);
    const mode = resolveSkillUseMode(options.provider, options.input);
    const details = resolveSkillUseDetails(options.provider, mode, options.input);

    const bound = skillRuntime.bind({
      container,
      provider: options.provider,
      mode,
      layer: options.input.layer,
      details
    });

    const activated = skillRuntime.activate({
      container: bound,
      provider: options.provider,
      includeResources: options.input.includeResources,
      includeHelpers: options.input.includeHelpers
    });
    const invocation = prepareSkillInvocation({
      provider: options.provider,
      model: options.model,
      layer: options.layer,
      variant: options.variant,
      compatibilityProfileId: options.compatibilityProfileId,
      input: {
        container: activated.container,
        includeResources: options.input.includeResources,
        includeHelpers: options.input.includeHelpers
      },
      session: options.session,
      tools: options.tools,
      policy: options.policy,
      metadata: options.metadata,
      providerOptions: options.providerOptions
    });

    return {
      container: activated.container,
      activation: activated.plan,
      invocation
    };
  }

  const mcpSharedSurface = {
    use: async (options: FacadeCallOptions<McpConnectInput>) => {
      assertMcpSharedExecutionAllowed(options);
      const normalized = normalizeMcpRequest("connect", options);
      const connection = await mcpRuntime.connect({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });

      return createMcpSessionHandle(
        {
          provider: normalized.provider,
          model: normalized.model,
          compatibilityProfileId: normalized.compatibilityProfileId
        },
        connection
      );
    },
    connect: async (options: FacadeCallOptions<McpConnectInput>) => {
      assertMcpSharedExecutionAllowed(options);
      const normalized = normalizeMcpRequest("connect", options);
      return mcpRuntime.connect({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    },
    listConnections: (options: FacadeCallOptions<Record<string, never>>) => {
      const normalized = normalizeMcpRequest("listConnections", options);
      return mcpRuntime.listConnections({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId
      });
    },
    disconnect: async (options: FacadeCallOptions<{ connectionId: string }>) => {
      const normalized = normalizeMcpRequest("disconnect", options);
      return mcpRuntime.disconnect({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        connectionId: normalized.input.connectionId
      });
    },
    disconnectAll: async (options: FacadeCallOptions<Record<string, never>>) => {
      const normalized = normalizeMcpRequest("disconnectAll", options);
      return mcpRuntime.disconnectAll({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId
      });
    },
    listTools: async (options: FacadeCallOptions<McpListToolsInput>) => {
      const normalized = normalizeMcpRequest("listTools", options);
      return mcpRuntime.listTools({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    },
    listResources: async (options: FacadeCallOptions<McpListResourcesInput>) => {
      const normalized = normalizeMcpRequest("listResources", options);
      return mcpRuntime.listResources({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    },
    readResource: async (options: FacadeCallOptions<McpReadResourceInput>) => {
      const normalized = normalizeMcpRequest("readResource", options);
      return mcpRuntime.readResource({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    },
    listPrompts: async (options: FacadeCallOptions<McpListPromptsInput>) => {
      const normalized = normalizeMcpRequest("listPrompts", options);
      return mcpRuntime.listPrompts({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    },
    getPrompt: async (options: FacadeCallOptions<McpGetPromptInput>) => {
      const normalized = normalizeMcpRequest("getPrompt", options);
      return mcpRuntime.getPrompt({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    },
    call: async (options: FacadeCallOptions<McpCallInput>) => {
      const normalized = normalizeMcpRequest("call", options);
      return mcpRuntime.call({
        provider: normalized.provider,
        model: normalized.model,
        layer: normalized.layer,
        compatibilityProfileId: normalized.compatibilityProfileId,
        input: normalized.input
      });
    }
  } satisfies RaxFacade["mcp"]["shared"];

  return {
    generate: {
      create: (options) => {
        return prepare("generate", "create", options);
      },
      stream: (options) => {
        return prepare("generate", "stream", options);
      }
    },
    embed: {
      create: (options) => {
        return prepare("embed", "create", options);
      }
    },
    file: {
      upload: (options) => {
        return prepare("file", "upload", options);
      }
    },
    batch: {
      submit: (options) => {
        return prepare("batch", "submit", options);
      }
    },
    websearch: {
      create: async (options) => {
        const fallbackRequest = createCapabilityRequest("search", "ground", options);

        try {
          const normalized = profiles
            ? applyCompatibilityProfile(fallbackRequest, profiles)
            : fallbackRequest;
          const invocation = prepare("search", "ground", options);
          return webSearchRuntime.executePreparedInvocation(
            invocation,
            normalized.compatibilityProfileId
          );
        } catch (error) {
          return webSearchRuntime.createErrorResult({
            provider: fallbackRequest.provider,
            model: fallbackRequest.model,
            compatibilityProfileId: fallbackRequest.compatibilityProfileId,
            error
          });
        }
      },
      prepare: (options) => {
        return prepare("search", "ground", options);
      }
    },
    mcp: {
      shared: mcpSharedSurface,
      native: {
        prepare: (options) => prepareNativeMcpPlan(options),
        serve: (options) => prepareMcpServePlan(options),
        build: (options) => buildNativeMcpInvocation(options),
        compose: (base, nativeInvocations) =>
          composeNativeMcpInvocation(
            base as PreparedInvocation<Record<string, unknown>>,
            nativeInvocations
          ) as unknown as typeof base,
        execute: (invocation) => mcpNativeRuntime.executePreparedInvocation(invocation),
        composeAndExecute: (base, nativeInvocations) =>
          mcpNativeRuntime.executePreparedInvocation(
            composeNativeMcpInvocation(
              base as PreparedInvocation<Record<string, unknown>>,
              nativeInvocations
            )
          )
      },
      use: mcpSharedSurface.use,
      connect: mcpSharedSurface.connect,
      listConnections: mcpSharedSurface.listConnections,
      disconnect: mcpSharedSurface.disconnect,
      disconnectAll: mcpSharedSurface.disconnectAll,
      listTools: mcpSharedSurface.listTools,
      listResources: mcpSharedSurface.listResources,
      readResource: mcpSharedSurface.readResource,
      listPrompts: mcpSharedSurface.listPrompts,
      getPrompt: mcpSharedSurface.getPrompt,
      call: mcpSharedSurface.call,
      serve: (options) => prepareMcpServePlan(options)
    },
    skill: {
      loadLocal: (input) => {
        return skillRuntime.loadLocal(input);
      },
      define: (input) => {
        return skillRuntime.define(input);
      },
      containerCreate: (input) => {
        return skillRuntime.containerCreate(input);
      },
      discover: (input) => {
        return skillRuntime.discover(input);
      },
      bind: (input) => {
        return skillRuntime.bind(input);
      },
      activate: (input) => {
        return skillRuntime.activate(input);
      },
      prepare: (options) => {
        return prepareSkillInvocation(options);
      },
      mount: (options) => {
        const prepared = prepareSkillInvocation({
          ...options,
          input: {
            container: options.input.container,
            includeResources: options.input.includeResources,
            includeHelpers: options.input.includeHelpers
          }
        });
        const boundContainer = options.input.container.bindings[options.provider]
          ? options.input.container
          : skillRuntime.bind({
              container: options.input.container,
              provider: options.provider,
              layer: options.layer === undefined || options.layer === "auto" ? undefined : options.layer
            });
        const activated = skillRuntime.activate({
          container: boundContainer,
          provider: options.provider,
          includeResources: options.input.includeResources,
          includeHelpers: options.input.includeHelpers
        });

        return {
          container: activated.container,
          activation: activated.plan,
          invocation: prepared
        };
      },
      compose: (base, skill) => {
        return composeSkillInvocation(base, skill);
      },
      use: (options) => {
        return useSkill(options);
      },
      list: (options) => {
        return prepareManagedSkillListInvocation(options);
      },
      get: (options) => {
        return prepareManagedSkillGetInvocation(options);
      },
      getContent: (options) => {
        return prepareManagedSkillContentGetInvocation(options);
      },
      publish: (options) => {
        return prepareManagedSkillPublishInvocation(options);
      },
      remove: (options) => {
        return prepareManagedSkillRemoveInvocation(options);
      },
      listVersions: (options) => {
        return prepareManagedSkillVersionListInvocation(options);
      },
      getVersion: (options) => {
        return prepareManagedSkillVersionGetInvocation(options);
      },
      getVersionContent: (options) => {
        return prepareManagedSkillVersionContentGetInvocation(options);
      },
      publishVersion: (options) => {
        return prepareManagedSkillVersionPublishInvocation(options);
      },
      removeVersion: (options) => {
        return prepareManagedSkillVersionRemoveInvocation(options);
      },
      setDefaultVersion: (options) => {
        return prepareManagedSkillSetDefaultInvocation(options);
      }
    }
  };
}
