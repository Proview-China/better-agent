import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import { buildWebSearchTaskPrompt, type WebSearchCreateInput } from "../../../../../rax/websearch-types.js";
import {
  buildGeminiPreparedInvocation,
  type GeminiPreparedPayload
} from "../../common.js";

export interface DeepMindWebSearchCreateInput extends WebSearchCreateInput {}

export const deepMindSearchGroundDescriptor: CapabilityAdapterDescriptor<
  DeepMindWebSearchCreateInput,
  GeminiPreparedPayload<Record<string, unknown>>
> = {
  id: "deepmind.api.search.ground.generate-content",
  key: "search.ground",
  namespace: "search",
  action: "ground",
  provider: "deepmind",
  layer: "api",
  description:
    "Lower a grounded web search request into the default Gemini generateContent grounding path using googleSearch and optional urlContext tools.",
  prepare(
    request: CapabilityRequest<DeepMindWebSearchCreateInput>
  ) {
    const input = request.input;
    const tools: Array<Record<string, unknown>> = [{ googleSearch: {} }];

    if (input.urls?.length) {
      tools.push({ urlContext: {} });
    }

    return buildGeminiPreparedInvocation(
      deepMindSearchGroundDescriptor,
      request,
      "ai.models.generateContent",
      {
        model: request.model,
        contents: buildWebSearchTaskPrompt(input),
        config: {
          tools,
          maxOutputTokens: input.maxOutputTokens
        }
      },
      [
        "Gemini grounded web search defaults to generateContent with the native googleSearch tool.",
        input.urls?.length
          ? "Known URLs trigger urlContext so the default route can inspect provided pages without a custom fetch stack."
          : "No explicit urlContext tool was added because the task does not provide target URLs on the default generateContent route."
      ]
    );
  }
};
