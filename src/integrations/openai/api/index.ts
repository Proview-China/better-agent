export type {
  OpenAIApiAdapterDescriptor,
  OpenAIBatchSubmitInput,
  OpenAIChatCompletionsGenerateInput,
  OpenAIEmbeddingsCreateInput,
  OpenAIFileUploadInput,
  OpenAIInvocationPayload,
  OpenAIResponsesGenerateInput,
  OpenAIResponsesGenerateStreamInput,
} from "./types.js";

export {
  openAIResponsesGenerateCreateDescriptor,
  openAIResponsesGenerateStreamDescriptor,
} from "./generation/responses/adapter.js";

export {
  openAIChatCompletionsGenerateCreateCompatDescriptor,
  openAIChatCompletionsGenerateStreamCompatDescriptor,
} from "./generation/chat_completions_compat/adapter.js";

export { openAIEmbeddingsCreateDescriptor } from "./modalities/embeddings/adapter.js";
export { openAIFilesUploadDescriptor } from "./resources/files/adapter.js";
export { openAIBatchesSubmitDescriptor } from "./operations/batches/adapter.js";

import {
  openAIBatchesSubmitDescriptor,
} from "./operations/batches/adapter.js";
import {
  openAIEmbeddingsCreateDescriptor,
} from "./modalities/embeddings/adapter.js";
import {
  openAIFilesUploadDescriptor,
} from "./resources/files/adapter.js";
import {
  openAIChatCompletionsGenerateCreateCompatDescriptor,
  openAIChatCompletionsGenerateStreamCompatDescriptor,
} from "./generation/chat_completions_compat/adapter.js";
import {
  openAIResponsesGenerateCreateDescriptor,
  openAIResponsesGenerateStreamDescriptor,
} from "./generation/responses/adapter.js";

export const openAIApiThinCapabilityDescriptors = [
  openAIResponsesGenerateCreateDescriptor,
  openAIResponsesGenerateStreamDescriptor,
  openAIChatCompletionsGenerateCreateCompatDescriptor,
  openAIChatCompletionsGenerateStreamCompatDescriptor,
  openAIEmbeddingsCreateDescriptor,
  openAIFilesUploadDescriptor,
  openAIBatchesSubmitDescriptor,
] as const;
