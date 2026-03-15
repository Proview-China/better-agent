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
  id: "deepmind.api.search.ground.interactions-create",
  key: "search.ground",
  namespace: "search",
  action: "ground",
  provider: "deepmind",
  layer: "api",
  description:
    "Lower a grounded web search request into Gemini Interactions API using google_search and optional url_context tools.",
  prepare(
    request: CapabilityRequest<DeepMindWebSearchCreateInput>
  ) {
    const input = request.input;
    const tools: Array<Record<string, unknown>> = [{ type: "google_search" }];

    if (input.urls?.length) {
      tools.push({ type: "url_context" });
    }

    return buildGeminiPreparedInvocation(
      deepMindSearchGroundDescriptor,
      request,
      "ai.interactions.create",
      {
        model: request.model,
        input: buildWebSearchTaskPrompt(input),
        tools
      },
      [
        "Gemini grounded web search uses the native google_search tool.",
        input.urls?.length
          ? "Known URLs trigger url_context so the runtime can inspect provided pages without a custom fetch stack."
          : "No explicit URL context tool was added because the task does not provide target URLs."
      ]
    );
  }
};
