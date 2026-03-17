export type WebSearchCitationMode = "required" | "preferred" | "off";

export type WebSearchFreshness = "any" | "day" | "week" | "month" | "year";

export interface WebSearchUserLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export interface WebSearchCreateInput {
  query: string;
  goal?: string;
  urls?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  // Some providers can enforce this directly while others only consume it as prompt guidance.
  maxSources?: number;
  // Some providers map this to a native output budget and others may ignore it until adapter support lands.
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
  raw?: unknown;
}

export interface WebSearchOutput {
  answer: string;
  citations: WebSearchCitation[];
  sources: WebSearchSource[];
  raw?: unknown;
}

export function buildWebSearchTaskPrompt(input: WebSearchCreateInput): string {
  const lines = [
    "Run a grounded web research task.",
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

  return lines.join("\n");
}

export function citationsEnabled(
  input: Pick<WebSearchCreateInput, "citations">
): boolean {
  return (input.citations ?? "required") !== "off";
}
