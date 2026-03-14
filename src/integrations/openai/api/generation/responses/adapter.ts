import type {
  CapabilityRequest,
} from "../../../../../rax/index.js";

import type {
  OpenAIApiAdapterDescriptor,
  OpenAIResponsesCreateParams,
  OpenAIResponsesGenerateInput,
  OpenAIResponsesGenerateStreamInput,
  OpenAIResponsesStreamParams,
} from "../../types.js";

import { omitUndefined, prepareOpenAIInvocation } from "../../types.js";

export const openAIResponsesGenerateCreateDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIResponsesGenerateInput,
  OpenAIResponsesCreateParams
> = {
  id: "openai.responses.generate.create",
  key: "generate.create",
  namespace: "generate",
  action: "create",
  provider: "openai",
  layer: "api",
  description:
    "Lower a unified generate.create request into OpenAI Responses API non-streaming params.",
  prepare(request: CapabilityRequest<OpenAIResponsesGenerateInput>) {
    const input = request.input;
    const params = omitUndefined({
      model: request.model ?? input.model,
      input: input.input,
      instructions: input.instructions,
      tools: input.tools ?? request.tools,
      tool_choice: input.toolChoice,
      include: input.include,
      conversation: input.conversation,
      previous_response_id: input.previousResponseId,
      max_output_tokens: input.maxOutputTokens,
      text: input.text,
      reasoning: input.reasoning,
      metadata: input.metadata,
      background: input.background,
      parallel_tool_calls: input.parallelToolCalls,
      prompt: input.prompt,
      prompt_cache_key: input.promptCacheKey,
      prompt_cache_retention: input.promptCacheRetention,
      safety_identifier: input.safetyIdentifier,
      service_tier: input.serviceTier,
      store: input.store,
      temperature: input.temperature,
      top_p: input.topP,
      truncation: input.truncation,
      user: input.user,
      stream: false as const,
    }) as OpenAIResponsesCreateParams;

    return prepareOpenAIInvocation(openAIResponsesGenerateCreateDescriptor, request, {
      surface: "responses",
      sdkMethodPath: "client.responses.create",
      params,
      notes: [
        "Responses is the primary OpenAI generation surface for rax thin generation paths.",
      ],
    });
  },
};

export const openAIResponsesGenerateStreamDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIResponsesGenerateStreamInput,
  OpenAIResponsesStreamParams
> = {
  id: "openai.responses.generate.stream",
  key: "generate.stream",
  namespace: "generate",
  action: "stream",
  provider: "openai",
  layer: "api",
  description:
    "Lower a unified generate.stream request into OpenAI Responses API streaming params.",
  prepare(request: CapabilityRequest<OpenAIResponsesGenerateStreamInput>) {
    const input = request.input;
    const params = omitUndefined({
      model: request.model ?? input.model,
      input: input.input,
      instructions: input.instructions,
      tools: input.tools ?? request.tools,
      tool_choice: input.toolChoice,
      include: input.include,
      conversation: input.conversation,
      previous_response_id: input.previousResponseId,
      max_output_tokens: input.maxOutputTokens,
      text: input.text,
      reasoning: input.reasoning,
      metadata: input.metadata,
      background: input.background,
      parallel_tool_calls: input.parallelToolCalls,
      prompt: input.prompt,
      prompt_cache_key: input.promptCacheKey,
      prompt_cache_retention: input.promptCacheRetention,
      safety_identifier: input.safetyIdentifier,
      service_tier: input.serviceTier,
      store: input.store,
      temperature: input.temperature,
      top_p: input.topP,
      truncation: input.truncation,
      user: input.user,
      stream: true as const,
      stream_options: input.streamOptions,
    }) as OpenAIResponsesStreamParams;

    return prepareOpenAIInvocation(openAIResponsesGenerateStreamDescriptor, request, {
      surface: "responses",
      sdkMethodPath: "client.responses.create",
      params,
      notes: [
        "Responses streaming stays on the same SDK method path and toggles stream=true.",
      ],
    });
  },
};
