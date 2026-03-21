import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation
} from "../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../rax/types.js";
import {
  buildWebSearchTaskPrompt,
  resolveSearchCapabilityKey,
  type WebSearchCreateInput
} from "../../../../rax/websearch-types.js";

export interface AnthropicAgentWebSearchInput extends WebSearchCreateInput {}

function buildAnthropicAgentPrompt(
  input: AnthropicAgentWebSearchInput
): string {
  return buildWebSearchTaskPrompt(input);
}

export const anthropicAgentSearchGroundDescriptor: CapabilityAdapterDescriptor<
  AnthropicAgentWebSearchInput,
  {
    command: string;
    args: string[];
    prompt: string;
  }
> = {
  id: "anthropic.agent.search.ground.claude-code",
  key: "search.ground",
  namespace: "search",
  action: "ground",
  provider: "anthropic",
  layer: "agent",
  description:
    "Lower a grounded web search request into the native Claude Code / agent runtime path.",
  prepare(
    request: CapabilityRequest<AnthropicAgentWebSearchInput>
  ) {
    const capabilityKey = resolveSearchCapabilityKey(request.input.capabilityKey);
    const prompt = buildAnthropicAgentPrompt({
      ...request.input,
      capabilityKey
    });
    return {
      key: "search.ground",
      provider: "anthropic",
      model: request.model,
      layer: "agent",
      variant: capabilityKey,
      adapterId: "anthropic.agent.search.ground.claude-code",
      sdk: {
        packageName: "@anthropic-ai/claude-agent-sdk",
        entrypoint: "claude -p --output-format json",
        notes:
          "Anthropic search.ground uses the Claude Code agent runtime path; search.web currently lowers through the same runtime as a compatibility surface."
      },
      payload: {
        command: "claude",
        args: ["-p", "--model", request.model, "--output-format", "json"],
        prompt
      }
    } satisfies PreparedInvocation<{
      command: string;
      args: string[];
      prompt: string;
    }>;
  }
};
