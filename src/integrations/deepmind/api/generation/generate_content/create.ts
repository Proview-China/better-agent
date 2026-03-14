import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  assertAction,
  buildGeminiPreparedInvocation,
  type GeminiModelCallInput,
  type GeminiModelCallParams,
  type GeminiPreparedPayload
} from "../../common.js";

export interface DeepMindGenerateCreateInput extends GeminiModelCallInput {}

export const deepMindGenerateCreateDescriptor: CapabilityAdapterDescriptor<
  DeepMindGenerateCreateInput,
  GeminiPreparedPayload<GeminiModelCallParams>
> = {
  id: "deepmind.api.generate.create.generate-content",
  key: "generate.create",
  namespace: "generate",
  action: "create",
  provider: "deepmind",
  layer: "api",
  description: "Lower a unified generate.create request to ai.models.generateContent().",
  prepare(
    request: CapabilityRequest<DeepMindGenerateCreateInput>
  ) {
    assertAction(request, "create");

    return buildGeminiPreparedInvocation(
      deepMindGenerateCreateDescriptor,
      request,
      "ai.models.generateContent",
      {
        model: request.model,
        contents: request.input.contents,
        config: request.input.config
      },
      [
        "Gemini create generation maps to ai.models.generateContent().",
        "Any DeepMind-specific client options stay in payload.clientOptions."
      ]
    );
  }
};
