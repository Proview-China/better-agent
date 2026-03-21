import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  buildWebSearchTaskPrompt,
  resolveSearchCapabilityKey,
  type WebSearchCreateInput
} from "../../../../../rax/websearch-types.js";
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
    "Lower a grounded web search request into Gemini generateContent using googleSearch and optional urlContext tools.",
  prepare(
    request: CapabilityRequest<DeepMindWebSearchCreateInput>
  ) {
    const input = request.input;
    const capabilityKey = resolveSearchCapabilityKey(input.capabilityKey);
    const tools: Array<Record<string, unknown>> = [{ googleSearch: {} }];

    if (input.urls?.length) {
      tools.push({ urlContext: {} });
    }

    const invocation = buildGeminiPreparedInvocation(
      deepMindSearchGroundDescriptor,
      request,
      "ai.models.generateContent",
      {
        model: request.model,
        contents: buildWebSearchTaskPrompt({
          ...input,
          capabilityKey
        }),
        config: {
          tools,
          maxOutputTokens: input.maxOutputTokens
        }
      },
      [
        "Gemini grounded web search uses generateContent with the native googleSearch tool.",
        input.urls?.length
          ? "Known URLs trigger urlContext so the runtime can inspect provided pages without a custom fetch stack."
          : "No explicit urlContext tool was added because the task does not provide target URLs."
      ]
    );

    return {
      ...invocation,
      variant: capabilityKey
    };
  }
};
