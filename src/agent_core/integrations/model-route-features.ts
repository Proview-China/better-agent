import {
  resolveProviderGenerationVariant,
  type ProviderGenerationVariant,
} from "../../rax/live-config.js";
import type { ProviderId } from "../../rax/index.js";
import type { RaxcodeReasoningEffort } from "../../raxcode-config.js";

export type ProviderRouteKind =
  | "openai_responses"
  | "openai_chat_completions"
  | "anthropic_messages"
  | "deepmind_generateContent";

export interface ParsedProviderModelSelectionValue {
  model: string;
  reasoning?: RaxcodeReasoningEffort;
  serviceTierFastEnabled: boolean;
}

export function resolveProviderRouteKind(input: {
  provider: ProviderId;
  baseURL: string;
  apiStyle?: string;
  variant?: string;
}): ProviderRouteKind {
  const variant = (input.variant as ProviderGenerationVariant | undefined)
    ?? resolveProviderGenerationVariant({
      provider: input.provider,
      baseURL: input.baseURL,
      apiStyle: input.apiStyle,
    });
  if (input.provider === "anthropic" || variant === "messages") {
    return "anthropic_messages";
  }
  if (input.provider === "deepmind" || variant === "generateContent") {
    return "deepmind_generateContent";
  }
  if (variant === "chat_completions_compat") {
    return "openai_chat_completions";
  }
  return "openai_responses";
}

export function providerRouteSupportsFast(kind: ProviderRouteKind): boolean {
  return kind === "openai_responses";
}

export function providerRouteSupportsReasoning(kind: ProviderRouteKind): boolean {
  return kind === "openai_responses" || kind === "anthropic_messages";
}

export function providerRouteReasoningLabel(kind: ProviderRouteKind): "Reasoning" | "Thinking" | null {
  if (kind === "openai_responses") {
    return "Reasoning";
  }
  if (kind === "anthropic_messages") {
    return "Thinking";
  }
  return null;
}

export function providerRouteDisplayName(kind: ProviderRouteKind): string {
  switch (kind) {
    case "openai_responses":
      return "GPT Compatible (Responses API)";
    case "openai_chat_completions":
      return "Gemini Compatible (Chat Completions API)";
    case "anthropic_messages":
      return "Anthropic Compatible (Messages API)";
    case "deepmind_generateContent":
      return "DeepMind Compatible (GenerateContent API)";
  }
}

export function formatProviderModelSelectionValue(input: {
  routeKind: ProviderRouteKind;
  model: string;
  reasoning?: RaxcodeReasoningEffort;
  serviceTierFastEnabled?: boolean;
}): string {
  const reasoning = input.reasoning ?? "none";
  switch (input.routeKind) {
    case "openai_responses":
      return `${input.model} with ${reasoning} effort${input.serviceTierFastEnabled ? " [FAST]" : ""}`;
    case "anthropic_messages":
      return `${input.model} with ${reasoning} thinking`;
    case "openai_chat_completions":
    case "deepmind_generateContent":
      return input.model;
  }
}

export function parseProviderModelSelectionValue(
  routeKind: ProviderRouteKind,
  value: string,
): ParsedProviderModelSelectionValue | null {
  if (routeKind === "openai_responses") {
    const match = value.match(/^(.*) with (minimal|none|low|medium|high|xhigh) effort(?: \[FAST\])?$/u);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    return {
      model: match[1].trim(),
      reasoning: match[2].trim() as RaxcodeReasoningEffort,
      serviceTierFastEnabled: /\s\[FAST\]$/u.test(value),
    };
  }
  if (routeKind === "anthropic_messages") {
    const match = value.match(/^(.*) with (none|low|medium|high|xhigh) thinking$/u);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    return {
      model: match[1].trim(),
      reasoning: match[2].trim() as RaxcodeReasoningEffort,
      serviceTierFastEnabled: false,
    };
  }
  const model = value.trim();
  if (!model) {
    return null;
  }
  return {
    model,
    serviceTierFastEnabled: false,
  };
}

export function sanitizeProviderRouteFeatureOptions(
  routeKind: ProviderRouteKind,
  input: {
    reasoningEffort?: string;
    serviceTier?: "fast";
  },
): {
  reasoningEffort?: string;
  serviceTier?: "fast";
} {
  return {
    reasoningEffort: providerRouteSupportsReasoning(routeKind)
      ? input.reasoningEffort
      : undefined,
    serviceTier: providerRouteSupportsFast(routeKind)
      ? input.serviceTier
      : undefined,
  };
}
