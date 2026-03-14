import type {
  CapabilityRequest,
} from "../../../../../rax/index.js";

import type {
  OpenAIApiAdapterDescriptor,
  OpenAIChatCompletionsCreateParams,
  OpenAIChatCompletionsGenerateInput,
  OpenAIChatCompletionsStreamParams,
} from "../../types.js";

import { omitUndefined, prepareOpenAIInvocation } from "../../types.js";

export const openAIChatCompletionsGenerateCreateCompatDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIChatCompletionsGenerateInput,
  OpenAIChatCompletionsCreateParams
> = {
  id: "openai.chat_completions_compat.generate.create",
  variant: "chat_completions_compat",
  key: "generate.create",
  namespace: "generate",
  action: "create",
  provider: "openai",
  layer: "api",
  description:
    "Compatibility lowerer for generate.create when the caller needs legacy chat.completions semantics.",
  prepare(request: CapabilityRequest<OpenAIChatCompletionsGenerateInput>) {
    const input = request.input;
    const params = omitUndefined({
      model: request.model ?? input.model,
      messages: input.messages,
      tools: input.tools ?? request.tools,
      tool_choice: input.toolChoice,
      response_format: input.responseFormat,
      metadata: input.metadata,
      max_completion_tokens: input.maxCompletionTokens,
      temperature: input.temperature,
      top_p: input.topP,
      user: input.user,
      reasoning_effort: input.reasoningEffort,
      web_search_options: input.webSearchOptions,
      stream: false as const,
    }) as OpenAIChatCompletionsCreateParams;

    return prepareOpenAIInvocation(
      openAIChatCompletionsGenerateCreateCompatDescriptor,
      request,
      {
        surface: "chat_completions",
        sdkMethodPath: "client.chat.completions.create",
        params,
        notes: [
          "This adapter is intentionally non-default and exists for chat-completions compatibility only.",
        ],
      },
    );
  },
};

export const openAIChatCompletionsGenerateStreamCompatDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIChatCompletionsGenerateInput,
  OpenAIChatCompletionsStreamParams
> = {
  id: "openai.chat_completions_compat.generate.stream",
  variant: "chat_completions_compat",
  key: "generate.stream",
  namespace: "generate",
  action: "stream",
  provider: "openai",
  layer: "api",
  description:
    "Compatibility lowerer for generate.stream when the caller needs legacy chat.completions semantics.",
  prepare(request: CapabilityRequest<OpenAIChatCompletionsGenerateInput>) {
    const input = request.input;
    const params = omitUndefined({
      model: request.model ?? input.model,
      messages: input.messages,
      tools: input.tools ?? request.tools,
      tool_choice: input.toolChoice,
      response_format: input.responseFormat,
      metadata: input.metadata,
      max_completion_tokens: input.maxCompletionTokens,
      temperature: input.temperature,
      top_p: input.topP,
      user: input.user,
      reasoning_effort: input.reasoningEffort,
      web_search_options: input.webSearchOptions,
      stream: true as const,
    }) as OpenAIChatCompletionsStreamParams;

    return prepareOpenAIInvocation(
      openAIChatCompletionsGenerateStreamCompatDescriptor,
      request,
      {
        surface: "chat_completions",
        sdkMethodPath: "client.chat.completions.create",
        params,
        notes: [
          "This adapter is intentionally non-default and exists for chat-completions compatibility only.",
        ],
      },
    );
  },
};
