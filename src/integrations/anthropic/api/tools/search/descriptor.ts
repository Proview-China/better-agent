import type Anthropic from "@anthropic-ai/sdk";
import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation
} from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  buildWebSearchTaskPrompt,
  citationsEnabled,
  type WebSearchCreateInput
} from "../../../../../rax/websearch-types.js";

export interface AnthropicWebSearchCreateInput extends WebSearchCreateInput {
  system?: Anthropic.MessageCreateParams["system"];
  metadata?: Anthropic.Metadata;
  temperature?: number;
}

const ANTHROPIC_SEARCH_SDK = {
  packageName: "@anthropic-ai/sdk",
  entrypoint: "client.messages.create",
  notes: "Grounded web search uses Anthropic Messages API server tools."
} as const;

function buildAnthropicSearchPrompt(
  input: AnthropicWebSearchCreateInput
): string {
  return buildWebSearchTaskPrompt(input);
}

function buildWebSearchTool(
  input: AnthropicWebSearchCreateInput
): Anthropic.WebSearchTool20260209 {
  return {
    name: "web_search",
    type: "web_search_20260209",
    allowed_domains: input.allowedDomains,
    blocked_domains: input.blockedDomains,
    max_uses: input.maxSources,
    user_location: input.userLocation
      ? {
          type: "approximate",
          city: input.userLocation.city,
          region: input.userLocation.region,
          country: input.userLocation.country,
          timezone: input.userLocation.timezone
        }
      : undefined
  };
}

function buildWebFetchTool(
  input: AnthropicWebSearchCreateInput
): Anthropic.WebFetchTool20260209 {
  return {
    name: "web_fetch",
    type: "web_fetch_20260209",
    allowed_domains: input.allowedDomains,
    blocked_domains: input.blockedDomains,
    citations: citationsEnabled(input) ? { enabled: true } : undefined,
    max_uses: input.maxSources
  };
}

export const anthropicSearchGroundDescriptor = {
  id: "anthropic.api.tools.search.ground",
  key: "search.ground",
  namespace: "search",
  action: "ground",
  provider: "anthropic",
  layer: "api",
  description:
    "Lower a grounded web search request into Anthropic Messages API using web_search and optional web_fetch server tools.",
  prepare(request) {
    const input = request.input;
    const tools: Anthropic.ToolUnion[] = [buildWebSearchTool(input)];

    if (input.urls?.length) {
      tools.push(buildWebFetchTool(input));
    }

    return {
      key: "search.ground",
      provider: "anthropic",
      model: request.model,
      layer: "api",
      adapterId: "anthropic.api.tools.search.ground",
      sdk: ANTHROPIC_SEARCH_SDK,
      payload: {
        model: request.model,
        max_tokens: input.maxOutputTokens ?? 1024,
        system: input.system,
        metadata: input.metadata,
        temperature: input.temperature,
        messages: [
          {
            role: "user",
            content: buildAnthropicSearchPrompt(input)
          }
        ],
        tools
      }
    } satisfies PreparedInvocation<Anthropic.MessageCreateParamsNonStreaming>;
  }
} satisfies CapabilityAdapterDescriptor<
  AnthropicWebSearchCreateInput,
  Anthropic.MessageCreateParamsNonStreaming
>;
