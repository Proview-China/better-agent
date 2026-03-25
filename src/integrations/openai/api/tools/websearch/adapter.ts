import type {
  ResponseCreateParamsNonStreaming,
  WebSearchTool
} from "openai/resources/responses/responses.js";

import type { CapabilityRequest } from "../../../../../rax/index.js";
import {
  buildWebSearchTaskPrompt,
  type WebSearchUserLocation
} from "../../../../../rax/websearch-types.js";
import type {
  OpenAIApiAdapterDescriptor,
  OpenAIWebSearchCreateInput
} from "../../types.js";
import { omitUndefined, prepareOpenAIInvocation } from "../../types.js";

function toOpenAIUserLocation(
  location?: WebSearchUserLocation
): WebSearchTool["user_location"] | undefined {
  if (!location) {
    return undefined;
  }

  return {
    type: "approximate",
    city: location.city,
    region: location.region,
    country: location.country,
    timezone: location.timezone
  };
}

function buildOpenAIWebSearchTool(
  input: OpenAIWebSearchCreateInput
): WebSearchTool {
  const filters = input.allowedDomains?.length || input.blockedDomains?.length
    ? omitUndefined({
        allowed_domains: input.allowedDomains,
        blocked_domains: input.blockedDomains
      })
    : undefined;

  return omitUndefined({
    type: "web_search",
    filters,
    search_context_size: input.searchContextSize,
    user_location: toOpenAIUserLocation(input.userLocation)
  }) as WebSearchTool;
}

export const openAIResponsesSearchGroundDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIWebSearchCreateInput,
  ResponseCreateParamsNonStreaming
> = {
  id: "openai.responses.search.ground",
  key: "search.ground",
  namespace: "search",
  action: "ground",
  provider: "openai",
  layer: "api",
  description:
    "Lower a unified grounded web search request into OpenAI Responses API with the native web_search tool.",
  prepare(request: CapabilityRequest<OpenAIWebSearchCreateInput>) {
    const input = request.input;
    const taskPrompt = buildWebSearchTaskPrompt(input);
    const params = omitUndefined({
      model: request.model ?? input.model,
      input: taskPrompt,
      include: ["web_search_call.action.sources"],
      max_output_tokens: input.maxOutputTokens,
      metadata: input.metadata,
      tools: [buildOpenAIWebSearchTool(input)],
      stream: false as const
    }) as ResponseCreateParamsNonStreaming;

    return prepareOpenAIInvocation(openAIResponsesSearchGroundDescriptor, request, {
      surface: "responses",
      sdkMethodPath: "client.responses.create",
      params,
      notes: [
        "Grounded web search uses the native Responses web_search tool and requests source annotations.",
        "Known URLs are folded into the task prompt because OpenAI does not expose a separate first-class fetch tool on this path.",
        "maxSources is applied as a prompt-level hint on this route because Responses web_search does not expose a dedicated hard cap for cited sources."
      ]
    });
  }
};
