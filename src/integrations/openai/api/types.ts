import type {
  BatchCreateParams,
  EmbeddingCreateParams,
  FileCreateParams,
} from "openai/resources/index.js";
import type {
  ChatCompletionCreateParamsBase,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions/completions.js";
import type {
  ResponseCreateParamsBase,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
} from "openai/resources/responses/responses.js";

import type {
  CapabilityRequest,
} from "../../../rax/index.js";
import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation,
} from "../../../rax/contracts.js";

export interface OpenAIInvocationPayload<TParams> {
  surface: "responses" | "chat_completions" | "embeddings" | "files" | "batches";
  sdkMethodPath: string;
  params: TParams;
  notes?: string[];
}

export type OpenAIApiAdapterDescriptor<TInput, TParams> =
  CapabilityAdapterDescriptor<TInput, OpenAIInvocationPayload<TParams>>;

export interface OpenAIResponsesGenerateInput {
  input: ResponseCreateParamsBase["input"];
  model?: ResponseCreateParamsBase["model"];
  instructions?: ResponseCreateParamsBase["instructions"];
  tools?: ResponseCreateParamsBase["tools"];
  toolChoice?: ResponseCreateParamsBase["tool_choice"];
  include?: ResponseCreateParamsBase["include"];
  conversation?: ResponseCreateParamsBase["conversation"];
  previousResponseId?: ResponseCreateParamsBase["previous_response_id"];
  maxOutputTokens?: ResponseCreateParamsBase["max_output_tokens"];
  text?: ResponseCreateParamsBase["text"];
  reasoning?: ResponseCreateParamsBase["reasoning"];
  metadata?: ResponseCreateParamsBase["metadata"];
  background?: ResponseCreateParamsBase["background"];
  parallelToolCalls?: ResponseCreateParamsBase["parallel_tool_calls"];
  prompt?: ResponseCreateParamsBase["prompt"];
  promptCacheKey?: ResponseCreateParamsBase["prompt_cache_key"];
  promptCacheRetention?: ResponseCreateParamsBase["prompt_cache_retention"];
  safetyIdentifier?: ResponseCreateParamsBase["safety_identifier"];
  serviceTier?: ResponseCreateParamsBase["service_tier"];
  store?: ResponseCreateParamsBase["store"];
  temperature?: ResponseCreateParamsBase["temperature"];
  topP?: ResponseCreateParamsBase["top_p"];
  truncation?: ResponseCreateParamsBase["truncation"];
  user?: ResponseCreateParamsBase["user"];
}

export interface OpenAIResponsesGenerateStreamInput extends OpenAIResponsesGenerateInput {
  streamOptions?: ResponseCreateParamsBase["stream_options"];
}

export interface OpenAIChatCompletionsGenerateInput {
  messages: ChatCompletionCreateParamsBase["messages"];
  model: ChatCompletionCreateParamsBase["model"];
  tools?: ChatCompletionCreateParamsBase["tools"];
  toolChoice?: ChatCompletionCreateParamsBase["tool_choice"];
  responseFormat?: ChatCompletionCreateParamsBase["response_format"];
  metadata?: ChatCompletionCreateParamsBase["metadata"];
  maxCompletionTokens?: ChatCompletionCreateParamsBase["max_completion_tokens"];
  temperature?: ChatCompletionCreateParamsBase["temperature"];
  topP?: ChatCompletionCreateParamsBase["top_p"];
  user?: ChatCompletionCreateParamsBase["user"];
  reasoningEffort?: ChatCompletionCreateParamsBase["reasoning_effort"];
  webSearchOptions?: ChatCompletionCreateParamsBase["web_search_options"];
}

export interface OpenAIEmbeddingsCreateInput {
  input: EmbeddingCreateParams["input"];
  model: EmbeddingCreateParams["model"];
  dimensions?: EmbeddingCreateParams["dimensions"];
  encodingFormat?: EmbeddingCreateParams["encoding_format"];
  user?: EmbeddingCreateParams["user"];
}

export interface OpenAIFileUploadInput {
  file: FileCreateParams["file"];
  purpose: FileCreateParams["purpose"];
  expiresAfter?: FileCreateParams["expires_after"];
}

export interface OpenAIBatchSubmitInput {
  completionWindow?: BatchCreateParams["completion_window"];
  endpoint: BatchCreateParams["endpoint"];
  inputFileId: BatchCreateParams["input_file_id"];
  metadata?: BatchCreateParams["metadata"];
  outputExpiresAfter?: BatchCreateParams["output_expires_after"];
}

export function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export function prepareOpenAIInvocation<TInput, TParams>(
  descriptor: Pick<OpenAIApiAdapterDescriptor<TInput, TParams>, "id" | "key" | "provider" | "layer" | "variant">,
  request: CapabilityRequest<TInput>,
  payload: OpenAIInvocationPayload<TParams>,
): PreparedInvocation<OpenAIInvocationPayload<TParams>> {
  return {
    key: descriptor.key,
    provider: descriptor.provider,
    model: request.model,
    layer: descriptor.layer,
    variant: descriptor.variant,
    adapterId: descriptor.id,
    sdk: {
      packageName: "openai",
      entrypoint: "openai",
      notes: "Prepared against the official openai Node SDK surface.",
    },
    payload,
  };
}

export type OpenAIResponsesCreateParams = ResponseCreateParamsNonStreaming;
export type OpenAIResponsesStreamParams = ResponseCreateParamsStreaming;
export type OpenAIChatCompletionsCreateParams = ChatCompletionCreateParamsNonStreaming;
export type OpenAIChatCompletionsStreamParams = ChatCompletionCreateParamsStreaming;
