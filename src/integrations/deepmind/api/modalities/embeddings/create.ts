import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  assertAction,
  buildGeminiPreparedInvocation,
  type GeminiModelCallInput,
  type GeminiModelCallParams,
  type GeminiPreparedPayload
} from "../../common.js";

export interface DeepMindEmbedCreateInput extends GeminiModelCallInput {}

export const deepMindEmbedCreateDescriptor: CapabilityAdapterDescriptor<
  DeepMindEmbedCreateInput,
  GeminiPreparedPayload<GeminiModelCallParams>
> = {
  id: "deepmind.api.embed.create.embed-content",
  key: "embed.create",
  namespace: "embed",
  action: "create",
  provider: "deepmind",
  layer: "api",
  description: "Lower a unified embed.create request to ai.models.embedContent().",
  prepare(
    request: CapabilityRequest<DeepMindEmbedCreateInput>
  ) {
    assertAction(request, "create");

    return buildGeminiPreparedInvocation(
      deepMindEmbedCreateDescriptor,
      request,
      "ai.models.embedContent",
      {
        model: request.model,
        contents: request.input.contents,
        config: request.input.config
      },
      [
        "Gemini embeddings map to ai.models.embedContent().",
        "The same shape carries both single-string and multimodal contents accepted by the SDK."
      ]
    );
  }
};
