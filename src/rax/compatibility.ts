import { CompatibilityBlockedError } from "./errors.js";
import type {
  CapabilityAction,
  CapabilityKey,
  CapabilityNamespace,
  CapabilityRequest,
  ProviderId
} from "./types.js";

export interface BaseCompatibilityProfile {
  id: string;
  provider: ProviderId;
  protocolFlavor?: string;
  disableCapabilities?: CapabilityKey[];
  unsupportedMode?: "blocked" | "skip";
  notes?: string[];
}

export interface OpenAICompatibilityProfile extends BaseCompatibilityProfile {
  provider: "openai";
  baseUrlNeedsV1?: boolean;
  defaultGenerationVariant?: "responses" | "chat_completions_compat";
  supportsModels?: boolean;
  supportsChatCompletionsStreaming?: boolean;
  supportsResponses?: boolean;
  supportsChatCompletions?: boolean;
  supportsEmbeddings?: boolean;
  supportsFiles?: boolean;
  supportsBatches?: boolean;
}

export interface AnthropicCompatibilityProfile extends BaseCompatibilityProfile {
  provider: "anthropic";
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
    supportsChatCompletionsStreaming: true,
    supportsResponses: true,
    supportsChatCompletions: true,
    supportsEmbeddings: true,
    supportsFiles: true,
    supportsBatches: true,
    notes: ["Official-shape expectation; non-official upstreams may downgrade to chat/completions only."]
  },
  {
    id: "anthropic-default",
    provider: "anthropic",
    protocolFlavor: "anthropic-official-like",
    supportsMessages: true,
    supportsStreamingMessages: true,
    supportsFilesBeta: true,
    supportsMessageBatches: true,
    notes: ["Official-shape expectation; many third-party channels only mimic core Messages API."]
  },
  {
    id: "deepmind-default",
    provider: "deepmind",
    protocolFlavor: "gemini-official-like",
    supportsOpenAIChatCompletions: false,
    supportsOpenAIEmbeddings: false,
    supportsAnthropicMessages: false,
    supportsGenerateContent: true,
    supportsGenerateContentStream: true,
    supportsEmbeddings: true,
    supportsFileUpload: true,
    supportsBatches: true,
    notes: ["Official-shape expectation; unofficial Gemini upstreams often fail on uploads and batch semantics."]
  }
] as const;

export const LOCAL_GATEWAY_COMPATIBILITY_PROFILES: readonly CompatibilityProfile[] = [
  {
    id: "openai-chat-only-gateway",
    provider: "openai",
    protocolFlavor: "openai-chat-only-gateway",
    disableCapabilities: ["search.web", "search.fetch", "search.ground"],
    unsupportedMode: "blocked",
    baseUrlNeedsV1: true,
    defaultGenerationVariant: "chat_completions_compat",
    supportsModels: true,
    supportsChatCompletions: true,
    supportsChatCompletionsStreaming: true,
    supportsResponses: false,
    supportsEmbeddings: false,
    supportsFiles: false,
    supportsBatches: false,
    notes: [
      "Treat this upstream as a chat/completions-compatible gateway rather than a full OpenAI platform proxy.",
      "Responses fails at the gateway layer; embeddings/files/batches appear unimplemented.",
      "Official native web search semantics should not be assumed on this gateway."
    ]
  },
  {
    id: "anthropic-messages-only-primary",
    provider: "anthropic",
    protocolFlavor: "anthropic-messages-only-gateway",
    supportsMessages: true,
    supportsStreamingMessages: true,
    supportsFilesBeta: false,
    supportsMessageBatches: false,
    disableCapabilities: ["file.upload", "batch.submit", "search.web", "search.fetch", "search.ground"],
    unsupportedMode: "blocked",
    preferredModelNames: [
      "claude-opus-4-6-thinking",
      "claude-sonnet-4-6",
      "claude-opus-4-6"
    ],
    modelFallbackStrategy: "ordered-first-success",
    notes: [
      "Treat this upstream as Messages plus streaming only.",
      "Files and message batches are not reliably supported.",
      "Do not assume Anthropic native web search/web fetch server tools exist on this gateway."
    ]
  },
  {
    id: "deepmind-openai-compatible-gateway",
    provider: "deepmind",
    protocolFlavor: "openai-compatible-gemini-backend",
    disableCapabilities: ["file.upload", "batch.submit", "search.web", "search.fetch", "search.ground"],
    unsupportedMode: "blocked",
    supportsOpenAIChatCompletions: true,
    supportsOpenAIEmbeddings: true,
    supportsAnthropicMessages: false,
    supportsGenerateContent: true,
    supportsGenerateContentStream: true,
    supportsEmbeddings: true,
    supportsFileUpload: false,
    supportsBatches: false,
    supportedModelHints: [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-pro",
      "gemini-embedding-001"
    ],
    notes: [
      "Prefer OpenAI-compatible chat/embeddings protocol for this gateway when reliability matters.",
      "Official Gemini file upload and batch semantics are not fully compatible.",
      "Official Google Search grounding and URL Context should not be assumed on this gateway."
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
