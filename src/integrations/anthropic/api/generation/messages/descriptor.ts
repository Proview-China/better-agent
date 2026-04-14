import type Anthropic from "@anthropic-ai/sdk";
import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation
} from "../../../../../rax/contracts.js";
import type {
  AnthropicGenerateCreateInput,
  AnthropicGenerateStreamInput
} from "../../shared.js";

const ANTHROPIC_MESSAGES_SDK = {
  packageName: "@anthropic-ai/sdk",
  entrypoint: "client.messages.create",
  notes: "Anthropic thin generation capabilities lower to the Messages API."
} as const;

function createMessagePayload(
  model: string,
  input: AnthropicGenerateCreateInput
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: input.maxTokens,
    messages: input.messages,
    system: input.system,
    metadata: input.metadata,
    stop_sequences: input.stopSequences,
    temperature: input.temperature,
    top_k: input.topK,
    top_p: input.topP,
    thinking: input.thinking,
    tools: input.tools,
    tool_choice: input.toolChoice,
    stream: false
  };
}

function createStreamingMessagePayload(
  model: string,
  input: AnthropicGenerateStreamInput
): Anthropic.MessageCreateParamsStreaming {
  return {
    model,
    max_tokens: input.maxTokens,
    messages: input.messages,
    system: input.system,
    metadata: input.metadata,
    stop_sequences: input.stopSequences,
    temperature: input.temperature,
    top_k: input.topK,
    top_p: input.topP,
    thinking: input.thinking,
    tools: input.tools,
    tool_choice: input.toolChoice,
    stream: true
  };
}

export const anthropicGenerateCreateDescriptor = {
  id: "anthropic.api.generation.messages.create",
  key: "generate.create",
  namespace: "generate",
  action: "create",
  provider: "anthropic",
  layer: "api",
  description: "Lower a unified generation request to Anthropic Messages API create.",
  prepare(request) {
    return {
      key: "generate.create",
      provider: "anthropic",
      model: request.model,
      layer: "api",
      adapterId: "anthropic.api.generation.messages.create",
      sdk: ANTHROPIC_MESSAGES_SDK,
      payload: createMessagePayload(request.model, request.input)
    } satisfies PreparedInvocation<Anthropic.MessageCreateParamsNonStreaming>;
  }
} satisfies CapabilityAdapterDescriptor<
  AnthropicGenerateCreateInput,
  Anthropic.MessageCreateParamsNonStreaming
>;

export const anthropicGenerateStreamDescriptor = {
  id: "anthropic.api.generation.messages.stream",
  key: "generate.stream",
  namespace: "generate",
  action: "stream",
  provider: "anthropic",
  layer: "api",
  description: "Lower a unified streamed generation request to Anthropic Messages API create(stream=true).",
  prepare(request) {
    return {
      key: "generate.stream",
      provider: "anthropic",
      model: request.model,
      layer: "api",
      adapterId: "anthropic.api.generation.messages.stream",
      sdk: ANTHROPIC_MESSAGES_SDK,
      payload: createStreamingMessagePayload(request.model, request.input)
    } satisfies PreparedInvocation<Anthropic.MessageCreateParamsStreaming>;
  }
} satisfies CapabilityAdapterDescriptor<
  AnthropicGenerateStreamInput,
  Anthropic.MessageCreateParamsStreaming
>;
