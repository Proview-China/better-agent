export const SEARCH_CAPABILITY_KEYS = [
  "search.web",
  "search.ground"
] as const;

export type SearchCapabilityKey = (typeof SEARCH_CAPABILITY_KEYS)[number];
export type SearchCapabilityAction = "web" | "ground";

export type WebSearchCitationMode = "required" | "preferred" | "off";

export type WebSearchFreshness = "any" | "day" | "week" | "month" | "year";

export interface WebSearchUserLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export interface WebSearchCreateInput {
  capabilityKey?: SearchCapabilityKey;
  query: string;
  goal?: string;
  urls?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxSources?: number;
  maxOutputTokens?: number;
  searchContextSize?: "low" | "medium" | "high";
  citations?: WebSearchCitationMode;
  freshness?: WebSearchFreshness;
  userLocation?: WebSearchUserLocation;
}

export interface WebSearchCitation {
  url: string;
  title?: string;
  snippet?: string;
  providerReference?: string;
  raw?: unknown;
}

export interface WebSearchSource {
  url: string;
  title?: string;
  snippet?: string;
  kind?: "search_result" | "fetched_page" | "citation";
  providerReference?: string;
  raw?: unknown;
}

export interface WebSearchEvidence {
  capabilityKey: SearchCapabilityKey;
  url: string;
  title?: string;
  snippet?: string;
  kind: "search_result" | "fetched_page" | "citation";
  providerReference?: string;
  raw?: unknown;
}

export interface WebSearchOutput {
  capabilityKey?: SearchCapabilityKey;
  answer: string;
  citations: WebSearchCitation[];
  sources: WebSearchSource[];
  raw?: unknown;
}

export function isSearchCapabilityKey(value: unknown): value is SearchCapabilityKey {
  return value === "search.web" || value === "search.ground";
}

export function resolveSearchCapabilityKey(
  value?: Pick<WebSearchCreateInput, "capabilityKey">["capabilityKey"] | string
): SearchCapabilityKey {
  return value === "search.web" ? "search.web" : "search.ground";
}

export function searchCapabilityAction(
  capabilityKey: SearchCapabilityKey
): SearchCapabilityAction {
  return capabilityKey === "search.web" ? "web" : "ground";
}

export function buildWebSearchTaskPrompt(input: WebSearchCreateInput): string {
  const capabilityKey = resolveSearchCapabilityKey(input.capabilityKey);
  const lines =
    capabilityKey === "search.web"
      ? [
          "Search the web for relevant sources and summarize the most useful findings.",
          `Primary query: ${input.query}`
        ]
      : [
          "Run a grounded web research task and answer using cited external sources.",
          `Primary query: ${input.query}`
        ];

  if (input.goal) {
    lines.push(`Goal: ${input.goal}`);
  }

  if (input.freshness && input.freshness !== "any") {
    lines.push(`Freshness preference: prioritize information from the last ${input.freshness}.`);
  }

  if (input.urls?.length) {
    lines.push(`Known URLs to inspect if relevant: ${input.urls.join(", ")}`);
  }

  if (input.allowedDomains?.length) {
    lines.push(`Prefer or limit results to these domains: ${input.allowedDomains.join(", ")}`);
  }

  if (input.blockedDomains?.length) {
    lines.push(`Do not rely on these domains: ${input.blockedDomains.join(", ")}`);
  }

  if (input.maxSources !== undefined) {
    lines.push(`Target no more than ${input.maxSources} distinct cited sources unless coverage requires fewer.`);
  }

  switch (input.citations ?? "required") {
    case "off":
      lines.push("Citations are optional in the final answer.");
      break;
    case "preferred":
      lines.push("Prefer source-linked claims in the final answer.");
      break;
    case "required":
    default:
      lines.push("Citations are required in the final answer.");
      break;
  }

  if (capabilityKey === "search.web") {
    lines.push("Prefer a concise search summary plus the most relevant sources.");
  } else {
    lines.push("Return a concise grounded answer and keep claims tied to cited sources.");
  }

  return lines.join("\n");
}

export function citationsEnabled(
  input: Pick<WebSearchCreateInput, "citations">
): boolean {
  return (input.citations ?? "required") !== "off";
}
