import type { CapabilityRequest } from "../../../../../rax/index.js";

import type {
  OpenAIApiAdapterDescriptor,
  OpenAIEmbeddingsCreateInput,
} from "../../types.js";

import { omitUndefined, prepareOpenAIInvocation } from "../../types.js";

export const openAIEmbeddingsCreateDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIEmbeddingsCreateInput,
  OpenAIEmbeddingsCreateInput
> = {
  id: "openai.embeddings.create",
  key: "embed.create",
  namespace: "embed",
  action: "create",
  provider: "openai",
  layer: "api",
  description:
    "Lower a unified embed.create request into OpenAI embeddings.create params.",
  prepare(request: CapabilityRequest<OpenAIEmbeddingsCreateInput>) {
    const input = request.input;

    return prepareOpenAIInvocation(openAIEmbeddingsCreateDescriptor, request, {
      surface: "embeddings",
      sdkMethodPath: "client.embeddings.create",
      params: omitUndefined({
        input: input.input,
        model: request.model ?? input.model,
        dimensions: input.dimensions,
        encoding_format: input.encodingFormat,
        user: input.user,
      }),
    });
  },
};
