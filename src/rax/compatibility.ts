import { CompatibilityBlockedError } from "./errors.js";
import type { McpTransportKind } from "./mcp-types.js";
import type {
  CapabilityAction,
  CapabilityKey,
  CapabilityNamespace,
  CapabilityRequest,
  ProviderId,
  SdkLayer
} from "./types.js";

export interface McpLayerCompatibility {
  supportedTransportKinds?: readonly McpTransportKind[];
  supportsResources?: boolean;
  supportsPrompts?: boolean;
  supportedModelHints?: readonly string[];
}

export interface McpCompatibilityProfile {
  api?: McpLayerCompatibility;
  agent?: McpLayerCompatibility;
}

export interface BaseCompatibilityProfile {
  id: string;
  provider: ProviderId;
  protocolFlavor?: string;
  disableCapabilities?: CapabilityKey[];
  unsupportedMode?: "blocked" | "skip";
  mcp?: McpCompatibilityProfile;
  notes?: string[];
}

export interface OpenAICompatibilityProfile extends BaseCompatibilityProfile {
  provider: "openai";
  baseUrlNeedsV1?: boolean;
  defaultGenerationVariant?: "responses" | "chat_completions_compat";
  supportsModels?: boolean;
  supportsManagedSkills?: boolean;
  supportsChatCompletionsStreaming?: boolean;
  supportsResponses?: boolean;
  supportsChatCompletions?: boolean;
  supportsEmbeddings?: boolean;
  supportsFiles?: boolean;
  supportsBatches?: boolean;
}

export interface AnthropicCompatibilityProfile extends BaseCompatibilityProfile {
  provider: "anthropic";
  supportsManagedSkills?: boolean;
  supportsMessages?: boolean;
  supportsStreamingMessages?: boolean;
  supportsFilesBeta?: boolean;
  supportsMessageBatches?: boolean;
  preferredModelNames?: string[];
  streamPreferredModelNames?: string[];
  modelFallbackStrategy?: "ordered-first-success";
}

export interface DeepMindCompatibilityProfile extends BaseCompatibilityProfile {
  provider: "deepmind";
  supportsManagedSkills?: boolean;
  supportsOpenAIChatCompletions?: boolean;
  supportsOpenAIEmbeddings?: boolean;
  supportsAnthropicMessages?: boolean;
  supportsGenerateContent?: boolean;
  supportsGenerateContentStream?: boolean;
  supportsEmbeddings?: boolean;
  supportsFileUpload?: boolean;
  supportsBatches?: boolean;
  supportedModelHints?: string[];
}

export type CompatibilityProfile =
  | OpenAICompatibilityProfile
  | AnthropicCompatibilityProfile
  | DeepMindCompatibilityProfile;

export const DEFAULT_COMPATIBILITY_PROFILES: readonly CompatibilityProfile[] = [
  {
    id: "openai-default",
    provider: "openai",
    protocolFlavor: "openai-official-like",
    baseUrlNeedsV1: true,
    defaultGenerationVariant: "responses",
    supportsModels: true,
    supportsManagedSkills: true,
    supportsChatCompletionsStreaming: true,
    supportsResponses: true,
    supportsChatCompletions: true,
    supportsEmbeddings: true,
    supportsFiles: true,
    supportsBatches: true,
    mcp: {
      api: {
        supportedTransportKinds: ["streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false
      },
      agent: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false
      }
    },
    notes: [
      "Official-shape expectation; non-official upstreams may downgrade to chat/completions only.",
      "For MCP, treat the OpenAI API carrier as remote/server-facing and tools-first rather than a full resources/prompts surface.",
      "Local stdio MCP semantics should be modeled on the OpenAI agent/runtime carrier instead of the API carrier."
    ]
  },
  {
    id: "anthropic-default",
    provider: "anthropic",
    protocolFlavor: "anthropic-official-like",
    supportsManagedSkills: true,
    supportsMessages: true,
    supportsStreamingMessages: true,
    supportsFilesBeta: true,
    supportsMessageBatches: true,
    mcp: {
      api: {
        supportedTransportKinds: ["streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false
      },
      agent: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: true,
        supportsPrompts: true
      }
    },
    notes: [
      "Official-shape expectation; many third-party channels only mimic core Messages API.",
      "For MCP, treat the API-side Anthropic connector as remote-first and tools-first rather than a full resources/prompts surface.",
      "Richer local stdio MCP semantics should be modeled on the Anthropic agent/runtime carrier instead of the API connector."
    ]
  },
  {
    id: "deepmind-default",
    provider: "deepmind",
    protocolFlavor: "gemini-official-like",
    supportsManagedSkills: false,
    supportsOpenAIChatCompletions: false,
    supportsOpenAIEmbeddings: false,
    supportsAnthropicMessages: false,
    supportsGenerateContent: true,
    supportsGenerateContentStream: true,
    supportsEmbeddings: true,
    supportsFileUpload: true,
    supportsBatches: true,
    mcp: {
      api: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false,
        supportedModelHints: [
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-2.0-flash"
        ]
      },
      agent: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false
      }
    },
    notes: [
      "Official-shape expectation; unofficial Gemini upstreams often fail on uploads and batch semantics.",
      "For MCP, treat the Gemini API carrier as tools-first and subject to model-family plus tool-combination restrictions.",
      "ADK runtime semantics should be modeled separately from Gemini API MCP semantics."
    ]
  }
] as const;

export const LOCAL_GATEWAY_COMPATIBILITY_PROFILES: readonly CompatibilityProfile[] = [
  {
    id: "openai-chat-only-gateway",
    provider: "openai",
    protocolFlavor: "openai-chat-only-gateway",
    disableCapabilities: [
      "search.web",
      "search.fetch",
      "search.ground",
      "skill.list",
      "skill.read",
      "skill.create",
      "skill.update",
      "skill.remove"
    ],
    unsupportedMode: "blocked",
    baseUrlNeedsV1: true,
    defaultGenerationVariant: "chat_completions_compat",
    supportsModels: true,
    supportsManagedSkills: false,
    supportsChatCompletions: true,
    supportsChatCompletionsStreaming: true,
    supportsResponses: false,
    supportsEmbeddings: false,
    supportsFiles: false,
    supportsBatches: false,
    mcp: {
      api: {
        supportedTransportKinds: [],
        supportsResources: false,
        supportsPrompts: false
      },
      agent: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false
      }
    },
    notes: [
      "Treat this upstream as a chat/completions-compatible gateway rather than a full OpenAI platform proxy.",
      "Responses fails at the gateway layer; embeddings/files/batches appear unimplemented.",
      "Official native web search semantics should not be assumed on this gateway.",
      "Do not assume official OpenAI API MCP connector semantics on this gateway; local MCP interoperability should be treated as a shared-runtime extension."
    ]
  },
  {
    id: "anthropic-messages-only-primary",
    provider: "anthropic",
    protocolFlavor: "anthropic-messages-only-gateway",
    supportsManagedSkills: false,
    supportsMessages: true,
    supportsStreamingMessages: true,
    supportsFilesBeta: false,
    supportsMessageBatches: false,
    disableCapabilities: [
      "file.upload",
      "batch.submit",
      "search.web",
      "search.fetch",
      "search.ground",
      "skill.list",
      "skill.read",
      "skill.create",
      "skill.update",
      "skill.remove"
    ],
    unsupportedMode: "blocked",
    mcp: {
      api: {
        supportedTransportKinds: [],
        supportsResources: false,
        supportsPrompts: false
      },
      agent: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: true,
        supportsPrompts: true
      }
    },
    preferredModelNames: [
      "claude-opus-4-6-thinking",
      "claude-sonnet-4-6",
      "claude-opus-4-6"
    ],
    modelFallbackStrategy: "ordered-first-success",
    notes: [
      "Treat this upstream as Messages plus streaming only.",
      "Files and message batches are not reliably supported.",
      "Do not assume Anthropic native web search/web fetch server tools exist on this gateway.",
      "Do not assume official Anthropic API MCP connector semantics on this gateway; local MCP interoperability should be treated as a shared-runtime extension."
    ]
  },
  {
    id: "deepmind-openai-compatible-gateway",
    provider: "deepmind",
    protocolFlavor: "openai-compatible-gemini-backend",
    supportsManagedSkills: false,
    disableCapabilities: [
      "file.upload",
      "batch.submit",
      "search.web",
      "search.fetch",
      "search.ground",
      "skill.list",
      "skill.read",
      "skill.create",
      "skill.update",
      "skill.remove"
    ],
    unsupportedMode: "blocked",
    supportsOpenAIChatCompletions: true,
    supportsOpenAIEmbeddings: true,
    supportsAnthropicMessages: false,
    supportsGenerateContent: true,
    supportsGenerateContentStream: true,
    supportsEmbeddings: true,
    supportsFileUpload: false,
    supportsBatches: false,
    mcp: {
      api: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false,
        supportedModelHints: [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-2.5-pro"
        ]
      },
      agent: {
        supportedTransportKinds: ["stdio", "streamable-http", "in-memory"],
        supportsResources: false,
        supportsPrompts: false
      }
    },
    supportedModelHints: [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-pro",
      "gemini-embedding-001"
    ],
    notes: [
      "Prefer OpenAI-compatible chat/embeddings protocol for this gateway when reliability matters.",
      "Official Gemini file upload and batch semantics are not fully compatible.",
      "Official Google Search grounding and URL Context should not be assumed on this gateway.",
      "Do not assume official Gemini MCP model support or tool-combination rules on this gateway; local MCP interoperability should be treated as a shared-runtime extension."
    ]
  }
] as const;

export function getCompatibilityProfile(
  provider: ProviderId,
  profiles: readonly CompatibilityProfile[] = DEFAULT_COMPATIBILITY_PROFILES,
  profileId?: string
): CompatibilityProfile {
  const profile = profileId
    ? profiles.find((entry) => entry.provider === provider && entry.id === profileId)
    : profiles.find((entry) => entry.provider === provider);
  if (!profile) {
    throw new Error(
      `Missing compatibility profile for provider ${provider}${profileId ? ` with id ${profileId}` : ""}.`
    );
  }
  return profile;
}

function buildCapabilityKey(
  capability: CapabilityNamespace,
  action: CapabilityAction
): CapabilityKey {
  return `${capability}.${action}` as CapabilityKey;
}

function getExplicitLayer(
  layer: SdkLayer | undefined
): Exclude<SdkLayer, "auto"> | undefined {
  if (layer === undefined || layer === "auto") {
    return undefined;
  }
  return layer;
}

function getMcpLayerProfile(
  profile: CompatibilityProfile,
  layer: Exclude<SdkLayer, "auto">
): McpLayerCompatibility | undefined {
  return profile.mcp?.[layer];
}

function getMcpTransportKindFromInput(input: unknown): McpTransportKind | undefined {
  if (
    typeof input === "object" &&
    input !== null &&
    "transport" in input &&
    typeof (input as { transport?: unknown }).transport === "object" &&
    (input as { transport?: unknown }).transport !== null &&
    "kind" in ((input as { transport?: { kind?: unknown } }).transport ?? {})
  ) {
    const kind = (input as { transport?: { kind?: unknown } }).transport?.kind;
    return typeof kind === "string" ? (kind as McpTransportKind) : undefined;
  }

  return undefined;
}

function applyMcpCompatibilityProfile<TInput>(
  request: CapabilityRequest<TInput>,
  profile: CompatibilityProfile,
  key: CapabilityKey
): void {
  if (request.capability !== "mcp") {
    return;
  }

  const layer = getExplicitLayer(request.layer);
  if (!layer) {
    return;
  }

  const layerProfile = getMcpLayerProfile(profile, layer);
  if (!layerProfile) {
    return;
  }

  if (request.action === "connect") {
    const transportKind = getMcpTransportKindFromInput(request.input);
    if (
      transportKind !== undefined &&
      layerProfile.supportedTransportKinds !== undefined &&
      !layerProfile.supportedTransportKinds.includes(transportKind)
    ) {
      throw new CompatibilityBlockedError(
        key,
        request.provider,
        profile.id,
        `${request.provider} ${key} on layer ${layer} does not support transport ${transportKind} under compatibility profile ${profile.id}.`
      );
    }

    if (
      layerProfile.supportedModelHints !== undefined &&
      !layerProfile.supportedModelHints.includes(request.model)
    ) {
      throw new CompatibilityBlockedError(
        key,
        request.provider,
        profile.id,
        `${request.provider} ${key} on layer ${layer} does not support model ${request.model} under compatibility profile ${profile.id}.`
      );
    }
  }

  if (
    (request.action === "listResources" || request.action === "readResource") &&
    layerProfile.supportsResources === false
  ) {
    throw new CompatibilityBlockedError(
      key,
      request.provider,
      profile.id,
      `${request.provider} ${key} on layer ${layer} is blocked by compatibility profile ${profile.id}.`
    );
  }

  if (
    (request.action === "listPrompts" || request.action === "getPrompt") &&
    layerProfile.supportsPrompts === false
  ) {
    throw new CompatibilityBlockedError(
      key,
      request.provider,
      profile.id,
      `${request.provider} ${key} on layer ${layer} is blocked by compatibility profile ${profile.id}.`
    );
  }
}

export function supportsCapabilityInProfile(
  profile: CompatibilityProfile,
  key: CapabilityKey
): boolean | undefined {
  switch (profile.provider) {
    case "openai":
      switch (key) {
        case "generate.create":
        case "generate.stream":
          return profile.defaultGenerationVariant === "chat_completions_compat"
            ? profile.supportsChatCompletions
            : profile.supportsResponses;
        case "skill.list":
        case "skill.read":
        case "skill.create":
        case "skill.update":
        case "skill.remove":
          return profile.supportsManagedSkills;
        case "embed.create":
          return profile.supportsEmbeddings;
        case "file.upload":
          return profile.supportsFiles;
        case "batch.submit":
          return profile.supportsBatches;
        default:
          return undefined;
      }
    case "anthropic":
      switch (key) {
        case "generate.create":
          return profile.supportsMessages;
        case "generate.stream":
          return profile.supportsStreamingMessages;
        case "skill.list":
        case "skill.read":
        case "skill.create":
        case "skill.update":
        case "skill.remove":
          return profile.supportsManagedSkills;
        case "file.upload":
          return profile.supportsFilesBeta;
        case "batch.submit":
          return profile.supportsMessageBatches;
        default:
          return undefined;
      }
    case "deepmind":
      switch (key) {
        case "generate.create":
          return profile.supportsGenerateContent;
        case "generate.stream":
          return profile.supportsGenerateContentStream;
        case "skill.list":
        case "skill.read":
        case "skill.create":
        case "skill.update":
        case "skill.remove":
          return profile.supportsManagedSkills;
        case "embed.create":
          return profile.supportsEmbeddings;
        case "file.upload":
          return profile.supportsFileUpload;
        case "batch.submit":
          return profile.supportsBatches;
        default:
          return undefined;
      }
  }
}

export function applyCompatibilityProfile<TInput>(
  request: CapabilityRequest<TInput>,
  profiles: readonly CompatibilityProfile[] = DEFAULT_COMPATIBILITY_PROFILES
): CapabilityRequest<TInput> {
  const profile = getCompatibilityProfile(
    request.provider,
    profiles,
    request.compatibilityProfileId
  );
  const key = buildCapabilityKey(request.capability, request.action);

  if (profile.disableCapabilities?.includes(key)) {
    throw new CompatibilityBlockedError(
      key,
      request.provider,
      profile.id,
      `${request.provider} ${key} is disabled by compatibility profile ${profile.id}.`
    );
  }

  const supported = supportsCapabilityInProfile(profile, key);
  if (supported === false && profile.unsupportedMode === "blocked") {
    throw new CompatibilityBlockedError(
      key,
      request.provider,
      profile.id,
      `${request.provider} ${key} is blocked by compatibility profile ${profile.id}.`
    );
  }

  applyMcpCompatibilityProfile(request, profile, key);

  if (
    profile.provider === "openai" &&
    request.capability === "generate" &&
    (request.action === "create" || request.action === "stream") &&
    request.variant === undefined &&
    profile.defaultGenerationVariant
  ) {
    return {
      ...request,
      variant: profile.defaultGenerationVariant
    };
  }

  return request;
}
