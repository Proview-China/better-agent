import type Anthropic from "@anthropic-ai/sdk";
import type { Uploadable } from "@anthropic-ai/sdk";
import type {
  CapabilityRequest,
  CapabilityResult
} from "../../../rax/types.js";

export type AnthropicThinkingConfig = Anthropic.MessageCreateParams["thinking"];

export interface AnthropicGenerateInputBase {
  maxTokens: number;
  messages: Anthropic.MessageParam[];
  system?: Anthropic.MessageCreateParams["system"];
  metadata?: Anthropic.Metadata;
  stopSequences?: string[];
  temperature?: number;
  topK?: number;
  topP?: number;
  thinking?: AnthropicThinkingConfig;
  tools?: Anthropic.ToolUnion[];
  toolChoice?: Anthropic.ToolChoice;
}

export interface AnthropicGenerateCreateInput extends AnthropicGenerateInputBase {
  stream?: false;
}

export interface AnthropicGenerateStreamInput extends AnthropicGenerateInputBase {
  stream?: true;
}

export interface AnthropicFileUploadInput {
  file: Uploadable;
  betas?: string[];
}

export interface AnthropicBatchRequestInput extends AnthropicGenerateInputBase {
  customId: string;
}

export interface AnthropicBatchSubmitInput {
  requests: AnthropicBatchRequestInput[];
  betas?: string[];
}

export interface UnsupportedCapabilityNotice {
  key: "embed.create";
  provider: "anthropic";
  layer: "api";
  supported: false;
  notes: string;
}

export function createAnthropicRequest<TInput>(
  request: CapabilityRequest<TInput>
): CapabilityRequest<TInput> {
  return request;
}

export function mapAnthropicReasoningEffortToThinking(
  reasoningEffort?: string,
): AnthropicThinkingConfig | undefined {
  switch (reasoningEffort) {
    case "low":
      return { type: "enabled", budget_tokens: 1024 };
    case "medium":
      return { type: "enabled", budget_tokens: 4096 };
    case "high":
      return { type: "enabled", budget_tokens: 8192 };
    case "max":
    case "xhigh":
      return { type: "enabled", budget_tokens: 16384 };
    default:
      return undefined;
  }
}

export function createUnsupportedResult(
  model: string,
  capability: "embed",
  action: "create",
  message: string
): CapabilityResult<never> {
  return {
    status: "blocked",
    provider: "anthropic",
    model,
    layer: "api",
    capability,
    action,
    error: {
      code: "unsupported_capability",
      message
    }
  };
}
