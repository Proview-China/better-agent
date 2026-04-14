import type { ProviderRouteKind } from "../integrations/model-route-features.js";
import type { PraxisSlashPanelFieldTone } from "./slash-panels.js";

export interface CoreIdentityValueSegment {
  text: string;
  tone?: PraxisSlashPanelFieldTone;
}

export interface CoreIdentityLabelPresentation {
  kind: "subscription" | "route";
  text: string;
  valueSegments: CoreIdentityValueSegment[];
}

function humanizeUnknownPlanLabel(planType: string): string {
  return planType
    .trim()
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatApiRouteIdentityText(routeKind: ProviderRouteKind): string {
  switch (routeKind) {
    case "openai_responses":
      return "GPT Endpoint (Responses API)";
    case "openai_chat_completions":
      return "GPT Compatible (Completions API)";
    case "anthropic_messages":
      return "Anthropic Endpoint (Messages API)";
    case "deepmind_generateContent":
      return "DeepMind Endpoint (GenerateContent API)";
  }
}

export function formatChatGPTPlanLabel(planType?: string): string {
  const normalized = planType?.trim().toLowerCase();
  switch (normalized) {
    case "pro20x":
    case "pro-20x":
    case "pro_20x":
      return "Pro20x";
    case "pro5x":
    case "pro-5x":
    case "pro_5x":
      return "Pro5x";
    case "pro":
      return "Pro";
    case "plus":
      return "Plus";
    case "go":
      return "Go";
    case "free":
      return "Free";
    default:
      return planType && planType.trim().length > 0
        ? humanizeUnknownPlanLabel(planType)
        : "Unknown";
  }
}

export function resolveChatGPTPlanTone(planType?: string): PraxisSlashPanelFieldTone | undefined {
  const normalized = planType?.trim().toLowerCase();
  switch (normalized) {
    case "pro20x":
    case "pro-20x":
    case "pro_20x":
    case "pro":
      return "planPro";
    case "pro5x":
    case "pro-5x":
    case "pro_5x":
      return "planPro5x";
    case "plus":
      return "planPlus";
    case "go":
      return "planGo";
    case "free":
      return "planFree";
    default:
      return undefined;
  }
}

export function buildCoreIdentityLabelPresentation(input: {
  authMode?: string;
  planType?: string;
  routeKind: ProviderRouteKind;
}): CoreIdentityLabelPresentation {
  if (input.authMode === "chatgpt_oauth") {
    const planLabel = formatChatGPTPlanLabel(input.planType);
    return {
      kind: "subscription",
      text: `ChatGPT Account with ${planLabel} Subscription`,
      valueSegments: [
        { text: "ChatGPT Account with " },
        { text: planLabel, tone: resolveChatGPTPlanTone(input.planType) },
        { text: " Subscription" },
      ],
    };
  }
  const routeText = formatApiRouteIdentityText(input.routeKind);
  return {
    kind: "route",
    text: routeText,
    valueSegments: [{ text: routeText }],
  };
}
