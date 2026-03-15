import type { FacadeCallOptions, PreparedInvocation } from "./contracts.js";
import { applyCompatibilityProfile, type CompatibilityProfile } from "./compatibility.js";
import { McpRuntime } from "./mcp-runtime.js";
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
  McpSessionHandle,
  McpReadResourceInput,
  McpReadResourceResult
} from "./mcp-types.js";
import { createCapabilityRequest, type CapabilityRouter } from "./router.js";
import { SkillRuntime } from "./skill-runtime.js";
import type {
  SkillActivateInput,
  SkillActivationPlan,
  SkillBindInput,
  SkillContainer,
  SkillContainerCreateInput,
  SkillDefineInput,
  SkillDescriptor,
  SkillDiscoverInput,
  SkillLoadLocalInput,
  SkillLocalPackage
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
  skill: {
    loadLocal(input: SkillLoadLocalInput): Promise<SkillLocalPackage>;
    define(input: SkillDefineInput): SkillContainer;
    containerCreate(input: SkillContainerCreateInput): Promise<SkillContainer>;
    discover(input: SkillDiscoverInput): Promise<SkillDescriptor[]>;
    bind(input: SkillBindInput): SkillContainer;
    activate(input: SkillActivateInput): { container: SkillContainer; plan: SkillActivationPlan };
  };
}

export function createRaxFacade(
  router: CapabilityRouter,
  profiles?: readonly CompatibilityProfile[],
  mcpRuntime = new McpRuntime(),
  webSearchRuntime: WebSearchRuntimeLike = new WebSearchRuntime(),
  skillRuntime = new SkillRuntime()
): RaxFacade {
  return createConfiguredRaxFacade(router, profiles, mcpRuntime, webSearchRuntime, skillRuntime);
}

export function createConfiguredRaxFacade(
  router: CapabilityRouter,
  profiles?: readonly CompatibilityProfile[],
  mcpRuntime = new McpRuntime(),
  webSearchRuntime: WebSearchRuntimeLike = new WebSearchRuntime(),
  skillRuntime = new SkillRuntime()
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

  function normalizeMcpRequest<TInput>(
    action:
      | "connect"
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
      use: async (options) => {
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
      connect: async (options) => {
        const normalized = normalizeMcpRequest("connect", options);
        return mcpRuntime.connect({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      },
      listConnections: (options) => {
        const normalized = normalizeMcpRequest("listConnections", options);
        return mcpRuntime.listConnections({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId
        });
      },
      disconnect: async (options) => {
        const normalized = normalizeMcpRequest("disconnect", options);
        return mcpRuntime.disconnect({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          connectionId: normalized.input.connectionId
        });
      },
      disconnectAll: async (options) => {
        const normalized = normalizeMcpRequest("disconnectAll", options);
        return mcpRuntime.disconnectAll({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId
        });
      },
      listTools: async (options) => {
        const normalized = normalizeMcpRequest("listTools", options);
        return mcpRuntime.listTools({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      },
      listResources: async (options) => {
        const normalized = normalizeMcpRequest("listResources", options);
        return mcpRuntime.listResources({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      },
      readResource: async (options) => {
        const normalized = normalizeMcpRequest("readResource", options);
        return mcpRuntime.readResource({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      },
      listPrompts: async (options) => {
        const normalized = normalizeMcpRequest("listPrompts", options);
        return mcpRuntime.listPrompts({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      },
      getPrompt: async (options) => {
        const normalized = normalizeMcpRequest("getPrompt", options);
        return mcpRuntime.getPrompt({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      },
      call: async (options) => {
        const normalized = normalizeMcpRequest("call", options);
        return mcpRuntime.call({
          provider: normalized.provider,
          model: normalized.model,
          layer: normalized.layer,
          compatibilityProfileId: normalized.compatibilityProfileId,
          input: normalized.input
        });
      }
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
      }
    }
  };
}
