import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  assertAction,
  buildGeminiPreparedInvocation,
  type GeminiModelCallInput,
  type GeminiModelCallParams,
  type GeminiPreparedPayload
} from "../../common.js";

export interface DeepMindGenerateStreamInput extends GeminiModelCallInput {}

export const deepMindGenerateStreamDescriptor: CapabilityAdapterDescriptor<
  DeepMindGenerateStreamInput,
  GeminiPreparedPayload<GeminiModelCallParams>
> = {
  id: "deepmind.api.generate.stream.generate-content-stream",
  key: "generate.stream",
  namespace: "generate",
  action: "stream",
  provider: "deepmind",
  layer: "api",
  description: "Lower a unified generate.stream request to ai.models.generateContentStream().",
  prepare(
    request: CapabilityRequest<DeepMindGenerateStreamInput>
  ) {
    assertAction(request, "stream");

    return buildGeminiPreparedInvocation(
      deepMindGenerateStreamDescriptor,
      request,
      "ai.models.generateContentStream",
      {
        model: request.model,
        contents: request.input.contents,
        config: request.input.config
      },
      [
        "Gemini streaming generation maps to ai.models.generateContentStream().",
        "The router can keep the same capability while the payload chooses the streaming SDK method."
      ]
    );
  }
};
