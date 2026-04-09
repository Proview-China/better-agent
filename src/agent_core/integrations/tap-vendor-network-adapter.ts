import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import {
  createCapabilityManifestFromPackage,
  createTapVendorNetworkCapabilityPackage,
  TAP_VENDOR_NETWORK_ACTIVATION_FACTORY_REFS,
  TAP_VENDOR_NETWORK_CAPABILITY_KEYS,
  type TapVendorNetworkCapabilityKey,
} from "../capability-package/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { ReplayPolicy } from "../ta-pool-types/index.js";
import type { ActivationAdapterFactory } from "../ta-pool-runtime/index.js";
import { rax } from "../../rax/index.js";
import type {
  ProviderId,
  SdkLayer,
  WebSearchCreateInput,
  WebSearchOutput,
} from "../../rax/index.js";

interface TapVendorNetworkFacade {
  websearch: {
    create(options: {
      provider: ProviderId;
      model: string;
      layer?: SdkLayer;
      variant?: string;
      compatibilityProfileId?: string;
      providerOptions?: Partial<Record<ProviderId, Record<string, unknown>>>;
      input: WebSearchCreateInput;
    }): Promise<{
      status: string;
      output?: WebSearchOutput;
      evidence?: unknown[];
      error?: unknown;
      provider: ProviderId;
      model: string;
      layer: Exclude<SdkLayer, "auto">;
    }>;
  };
}

export interface TapVendorNetworkFetcherResponse {
  url: string;
  finalUrl?: string;
  title?: string;
  contentType?: string;
  content: string;
  contentChars: number;
  truncated: boolean;
  transport: "direct" | "jina" | "redirect_notice";
  status: number;
  backend?: SearchFetchBackendKind;
  redirectTarget?: string;
  fallbackApplied?: boolean;
  errorCode?: string;
}

export type SearchFetchBackendKind =
  | "anthropic-claude-code-native"
  | "gemini-cli-native"
  | "portable-fallback";

export type SearchWebBackendKind =
  | "openai-codex-style-web-search"
  | "anthropic-claude-code-web-search"
  | "gemini-cli-web-search"
  | "portable-search-fallback";

export interface TapVendorNetworkAdapterOptions {
  capabilityKey?: TapVendorNetworkCapabilityKey;
  facade?: TapVendorNetworkFacade;
  fetcher?: (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>;
  backendFetchers?: Partial<
    Record<
      SearchFetchBackendKind,
      (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>
    >
  >;
}

export interface TapVendorNetworkRegistrationTarget {
  registerCapabilityAdapter(
    manifest: CapabilityManifest,
    adapter: CapabilityAdapter,
  ): unknown;
  registerTaActivationFactory(
    ref: string,
    factory: ActivationAdapterFactory,
  ): void;
}

export interface RegisterTapVendorNetworkCapabilityFamilyInput {
  runtime: TapVendorNetworkRegistrationTarget;
  facade?: TapVendorNetworkFacade;
  fetcher?: (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>;
  backendFetchers?: Partial<
    Record<
      SearchFetchBackendKind,
      (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>
    >
  >;
  capabilityKeys?: readonly TapVendorNetworkCapabilityKey[];
  replayPolicy?: ReplayPolicy;
}

export interface RegisterTapVendorNetworkCapabilityFamilyResult {
  capabilityKeys: TapVendorNetworkCapabilityKey[];
  activationFactoryRefs: string[];
  manifests: CapabilityManifest[];
  packages: CapabilityPackage[];
  bindings: unknown[];
}

interface SearchRouteContext {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
  providerOptions?: Partial<Record<ProviderId, Record<string, unknown>>>;
}

interface SearchWebExecutionInput extends WebSearchCreateInput {
  route: SearchRouteContext;
}

interface SearchWebExecutionResult {
  selectedBackend: SearchWebBackendKind;
  resolvedBackend: SearchWebBackendKind;
  layer: "native" | "portable";
  fallbackApplied: boolean;
  result: Awaited<ReturnType<TapVendorNetworkFacade["websearch"]["create"]>>;
  normalizedOutput: ReturnType<typeof toSearchWebOutput>;
}

interface SearchFetchExecutionInput {
  urls: string[];
  prompt?: string;
  maxChars?: number;
  route?: SearchRouteContext;
}

interface SearchFetchExecutionResult {
  pages: TapVendorNetworkFetcherResponse[];
  selectedBackend: SearchFetchBackendKind;
  resolvedBackend: SearchFetchBackendKind;
  layer: "native" | "portable";
  fallbackApplied: boolean;
}

interface PortableSearchResult {
  title: string;
  url: string;
}

type PreparedVendorNetworkState =
  | {
      capabilityKey: "search.web" | "search.ground";
      input: SearchWebExecutionInput;
    }
  | {
      capabilityKey: "search.fetch";
      input: SearchFetchExecutionInput;
    };

class SearchFetchExecutionError extends Error {
  readonly code: string;
  readonly fallbackEligible: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: {
      fallbackEligible?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "SearchFetchExecutionError";
    this.code = code;
    this.fallbackEligible = options?.fallbackEligible ?? false;
    this.details = options?.details;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "deepmind";
}

function isSdkLayer(value: unknown): value is SdkLayer {
  return value === "api" || value === "agent" || value === "auto";
}

function mapSearchStatus(status: string): "success" | "partial" | "failed" | "blocked" | "timeout" {
  switch (status) {
    case "success":
    case "partial":
    case "failed":
    case "blocked":
    case "timeout":
      return status;
    default:
      return "failed";
  }
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildFingerprint(capabilityKey: string, input: unknown): string {
  return createHash("sha256")
    .update(`${capabilityKey}:${stableStringify(input)}`)
    .digest("hex");
}

function normalizeRoute(input: Record<string, unknown>): SearchRouteContext {
  const route = asRecord(input.route);
  const provider = route?.provider ?? input.provider;
  const model = asString(route?.model ?? input.model);
  const layer = route?.layer ?? input.layer;
  const variant = asString(route?.variant ?? input.variant);
  const compatibilityProfileId = asString(
    route?.compatibilityProfileId ?? input.compatibilityProfileId,
  );
  const providerOptions = asRecord(route?.providerOptions ?? input.providerOptions) as
    | Partial<Record<ProviderId, Record<string, unknown>>>
    | undefined;

  if (!isProviderId(provider)) {
    throw new Error("vendor network adapter input is missing a valid provider.");
  }
  if (!model) {
    throw new Error("vendor network adapter input is missing model.");
  }

  return {
    provider,
    model,
    layer: isSdkLayer(layer) ? layer : undefined,
    variant,
    compatibilityProfileId,
    providerOptions,
  };
}

function parseSearchInput(
  capabilityKey: "search.web" | "search.ground",
  plan: CapabilityInvocationPlan,
): SearchWebExecutionInput {
  const input = plan.input;
  const query = asString(input.query) ?? asString(input.question) ?? asString(input.prompt);
  if (!query) {
    throw new Error(`${capabilityKey} invocation is missing query.`);
  }

  return {
    route: normalizeRoute(input),
    query,
    goal: asString(input.goal),
    urls: asStringArray(input.urls),
    allowedDomains: asStringArray(input.allowedDomains),
    blockedDomains: asStringArray(input.blockedDomains),
    maxSources: asPositiveInteger(input.maxSources),
    maxOutputTokens: asPositiveInteger(input.maxOutputTokens),
    searchContextSize:
      input.searchContextSize === "low" || input.searchContextSize === "medium" || input.searchContextSize === "high"
        ? input.searchContextSize
        : undefined,
    citations:
      input.citations === "required" || input.citations === "preferred" || input.citations === "off"
        ? input.citations
        : capabilityKey === "search.ground"
          ? "required"
          : "preferred",
    freshness:
      input.freshness === "any" ||
      input.freshness === "day" ||
      input.freshness === "week" ||
      input.freshness === "month" ||
      input.freshness === "year"
        ? input.freshness
        : undefined,
    userLocation: asRecord(input.userLocation) as WebSearchCreateInput["userLocation"] | undefined,
  };
}

function parseSearchFetchInput(plan: CapabilityInvocationPlan): SearchFetchExecutionInput {
  const input = plan.input;
  const urls = asStringArray(input.urls)
    ?? (asString(input.url) ? [asString(input.url)!] : undefined);
  if (!urls || urls.length === 0) {
    throw new Error("search.fetch invocation requires url or urls.");
  }

  return {
    urls,
    prompt: asString(input.prompt) ?? asString(input.goal),
    maxChars: asPositiveInteger(input.maxChars) ?? 20_000,
    route:
      input.route || input.provider || input.model
        ? normalizeRoute(input)
        : undefined,
  };
}

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return {
    text: `${value.slice(0, Math.max(0, maxChars - 1))}…`,
    truncated: true,
  };
}

function extractTitleFromHtml(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/iu);
  return match?.[1]?.trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, "\"")
    .replace(/&#39;/giu, "'");
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/giu, " ")
      .replace(/<style[\s\S]*?<\/style>/giu, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/giu, " ")
      .replace(/<!--[\s\S]*?-->/gu, " ")
      .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])[^>]*>/giu, "\n")
      .replace(/<[^>]+>/gu, " ")
      .replace(/\r/gu, "")
      .replace(/\t/gu, " ")
      .replace(/[ ]{2,}/gu, " ")
      .replace(/\n{3,}/gu, "\n\n"),
  ).trim();
}

function isHtmlLikeContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return true;
  }
  const lowered = contentType.toLowerCase();
  return lowered.includes("text/html") || lowered.includes("application/xhtml+xml");
}

function normalizeFetchedContent(
  rawContent: string,
  contentType: string | undefined,
  maxChars: number,
): { content: string; contentChars: number; truncated: boolean; title?: string } {
  const isHtml = isHtmlLikeContentType(contentType);
  const normalizedSource = isHtml ? htmlToText(rawContent) : rawContent.trim();
  const normalized = truncateText(normalizedSource, maxChars);
  return {
    content: normalized.text,
    contentChars: normalizedSource.length,
    truncated: normalized.truncated,
    title: isHtml ? extractTitleFromHtml(rawContent) : undefined,
  };
}

function sanitizeHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname.toLowerCase();
}

function isDeniedHostname(hostname: string): boolean {
  const lowered = sanitizeHostname(hostname);
  if (
    lowered === "localhost"
    || lowered === "127.0.0.1"
    || lowered === "::1"
    || lowered.endsWith(".local")
    || lowered.endsWith(".internal")
  ) {
    return true;
  }

  const ipVersion = isIP(lowered);
  if (ipVersion === 4) {
    if (
      lowered.startsWith("0.")
      || lowered.startsWith("10.")
      || lowered.startsWith("127.")
      || lowered.startsWith("169.254.")
      || lowered.startsWith("192.168.")
    ) {
      return true;
    }
    const carrierGrade = lowered.match(/^100\.(\d+)\./u);
    if (carrierGrade) {
      const secondOctet = Number(carrierGrade[1]);
      if (secondOctet >= 64 && secondOctet <= 127) {
        return true;
      }
    }
    const benchmark = lowered.match(/^198\.(\d+)\./u);
    if (benchmark) {
      const secondOctet = Number(benchmark[1]);
      if (secondOctet === 18 || secondOctet === 19) {
        return true;
      }
    }
    const match = lowered.match(/^172\.(\d+)\./u);
    if (match) {
      const secondOctet = Number(match[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }

  if (ipVersion === 6) {
    return (
      lowered === "::1"
      || lowered.startsWith("fc")
      || lowered.startsWith("fd")
      || lowered.startsWith("fe8")
      || lowered.startsWith("fe9")
      || lowered.startsWith("fea")
      || lowered.startsWith("feb")
    );
  }

  return false;
}

function getVendorNetworkUserAgent(kind: SearchFetchBackendKind): string {
  switch (kind) {
    case "anthropic-claude-code-native":
      return "Mozilla/5.0 (compatible; Anthropic-Claude-Code-WebFetch/1.0; +https://www.anthropic.com/claude-code)";
    case "gemini-cli-native":
      return "Mozilla/5.0 (compatible; Google-Gemini-CLI/1.0; +https://github.com/google-gemini/gemini-cli)";
    case "portable-fallback":
    default:
      return "Mozilla/5.0 (compatible; Praxis TAP Vendor Network/1.0; +https://github.com/Proview-China/Praxis)";
  }
}

function isAnthropicLikeRoute(route: SearchRouteContext | undefined): boolean {
  return route?.provider === "anthropic" || Boolean(route?.model && /claude/iu.test(route.model));
}

function isGeminiLikeRoute(route: SearchRouteContext | undefined): boolean {
  return route?.provider === "deepmind" || Boolean(route?.model && /gemini/iu.test(route.model));
}

function isOpenAILikeRoute(route: SearchRouteContext | undefined): boolean {
  return route?.provider === "openai" || Boolean(route?.model && /^gpt|o[13-9]/iu.test(route.model));
}

function selectSearchFetchBackend(route: SearchRouteContext | undefined): SearchFetchBackendKind {
  if (isAnthropicLikeRoute(route)) {
    return "anthropic-claude-code-native";
  }
  if (isGeminiLikeRoute(route)) {
    return "gemini-cli-native";
  }
  return "portable-fallback";
}

function selectSearchWebBackend(route: SearchRouteContext | undefined): SearchWebBackendKind {
  if (isOpenAILikeRoute(route)) {
    return "openai-codex-style-web-search";
  }
  if (isAnthropicLikeRoute(route)) {
    return "anthropic-claude-code-web-search";
  }
  if (isGeminiLikeRoute(route)) {
    return "gemini-cli-web-search";
  }
  return "portable-search-fallback";
}

function mergeProviderOptions(
  current: Partial<Record<ProviderId, Record<string, unknown>>> | undefined,
  provider: ProviderId,
  patch: Record<string, unknown>,
): Partial<Record<ProviderId, Record<string, unknown>>> {
  return {
    ...(current ?? {}),
    [provider]: {
      ...(current?.[provider] ?? {}),
      ...patch,
    },
  };
}

function shapeSearchInputForBackend(
  capabilityKey: "search.web" | "search.ground",
  input: SearchWebExecutionInput,
  backend: SearchWebBackendKind,
): SearchWebExecutionInput {
  if (backend === "openai-codex-style-web-search") {
    return {
      ...input,
      citations:
        input.citations
        ?? (capabilityKey === "search.ground" ? "required" : "preferred"),
      searchContextSize: input.searchContextSize ?? "medium",
      route: {
        ...input.route,
        providerOptions: mergeProviderOptions(input.route.providerOptions, "openai", {
          external_web_access: true,
        }),
      },
    };
  }

  if (backend === "anthropic-claude-code-web-search") {
    return {
      ...input,
      citations:
        input.citations
        ?? (capabilityKey === "search.ground" ? "required" : "preferred"),
      maxSources: Math.min(input.maxSources ?? 8, 8),
      route: {
        ...input.route,
        providerOptions: mergeProviderOptions(input.route.providerOptions, "anthropic", {
          max_uses: Math.min(input.maxSources ?? 8, 8),
          search_tool: "web_search_20260209",
          fetch_tool: input.urls?.length ? "web_fetch_20260209" : undefined,
        }),
      },
    };
  }

  if (backend === "gemini-cli-web-search") {
    return {
      ...input,
      searchContextSize: input.searchContextSize ?? "medium",
      route: {
        ...input.route,
        providerOptions: mergeProviderOptions(input.route.providerOptions, "deepmind", {
          googleSearch: true,
          urlContext: Array.isArray(input.urls) && input.urls.length > 0,
        }),
      },
    };
  }

  return input;
}

function validateFetchUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (cause) {
    throw new SearchFetchExecutionError(
      "search_fetch_invalid_url",
      `search.fetch received an invalid URL: ${url}`,
      { details: { url }, cause },
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SearchFetchExecutionError(
      "search_fetch_invalid_protocol",
      `search.fetch only supports http/https URLs: ${url}`,
      { details: { url, protocol: parsed.protocol } },
    );
  }
  if (parsed.username || parsed.password) {
    throw new SearchFetchExecutionError(
      "search_fetch_credentialed_url_denied",
      `search.fetch denied credentialed URL: ${url}`,
      { details: { url } },
    );
  }
  return parsed;
}

async function ensureNotDeniedTarget(url: string, verifyDns: boolean): Promise<void> {
  const parsed = validateFetchUrl(url);
  if (isDeniedHostname(parsed.hostname)) {
    throw new SearchFetchExecutionError(
      "search_fetch_private_target_denied",
      `search.fetch denied local or private target: ${parsed.hostname}`,
      { details: { url, hostname: parsed.hostname } },
    );
  }
  if (!verifyDns || isIP(sanitizeHostname(parsed.hostname))) {
    return;
  }
  try {
    const addresses = await lookup(parsed.hostname, { all: true });
    if (addresses.some((entry) => isDeniedHostname(entry.address))) {
      throw new SearchFetchExecutionError(
        "search_fetch_private_resolution_denied",
        `search.fetch denied host that resolves to a private address: ${parsed.hostname}`,
        { details: { url, hostname: parsed.hostname, addresses: addresses.map((entry) => entry.address) } },
      );
    }
  } catch (error) {
    if (error instanceof SearchFetchExecutionError) {
      throw error;
    }
    throw new SearchFetchExecutionError(
      "search_fetch_dns_verification_failed",
      `search.fetch could not verify whether ${parsed.hostname} resolves to a private address.`,
      {
        fallbackEligible: true,
        details: { url, hostname: parsed.hostname },
        cause: error,
      },
    );
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isPermittedClaudeRedirect(originalUrl: string, redirectUrl: string): boolean {
  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);
    if (redirect.protocol !== original.protocol || redirect.port !== original.port) {
      return false;
    }
    if (redirect.username || redirect.password) {
      return false;
    }
    const stripWww = (hostname: string) => sanitizeHostname(hostname).replace(/^www\./u, "");
    return stripWww(original.hostname) === stripWww(redirect.hostname);
  } catch {
    return false;
  }
}

function buildRedirectNotice(
  originalUrl: string,
  redirectUrl: string,
  status: number,
): string {
  return [
    "REDIRECT DETECTED: The requested URL redirects to a different host.",
    `Original URL: ${originalUrl}`,
    `Redirect URL: ${redirectUrl}`,
    `Status: ${status}`,
    "A new explicit fetch should be issued for the redirect target.",
  ].join("\n");
}

async function fetchResponse(
  url: string,
  backend: SearchFetchBackendKind,
  redirect: "follow" | "manual" | "error",
): Promise<Response> {
  return fetch(url, {
    headers: {
      "user-agent": getVendorNetworkUserAgent(backend),
      accept: "text/markdown, text/plain, text/html, application/json, */*",
    },
    redirect,
  });
}

async function fetchPortableSearchPages(
  adapterFetcher: ((input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>) | undefined,
  backendFetchers: Partial<
    Record<
      SearchFetchBackendKind,
      (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>
    >
  >,
  input: SearchFetchExecutionInput,
): Promise<TapVendorNetworkFetcherResponse[]> {
  if (adapterFetcher) {
    return adapterFetcher(input);
  }
  return executeSearchFetchBackend("portable-fallback", input, backendFetchers);
}

async function fetchClaudeCodeNativePage(
  url: string,
  maxChars: number,
  redirectDepth = 0,
): Promise<TapVendorNetworkFetcherResponse> {
  if (redirectDepth >= 10) {
    throw new SearchFetchExecutionError(
      "search_fetch_redirect_limit_exceeded",
      "search.fetch hit the Claude-style redirect limit.",
      { fallbackEligible: true, details: { url, redirectDepth } },
    );
  }

  await ensureNotDeniedTarget(url, false);
  const response = await fetchResponse(url, "anthropic-claude-code-native", "manual");
  if (isRedirectStatus(response.status)) {
    const location = response.headers.get("location");
    if (!location) {
      throw new SearchFetchExecutionError(
        "search_fetch_redirect_missing_location",
        "search.fetch received a redirect response without a Location header.",
        { fallbackEligible: true, details: { url, status: response.status } },
      );
    }
    const redirectUrl = new URL(location, url).toString();
    await ensureNotDeniedTarget(redirectUrl, false);
    if (isPermittedClaudeRedirect(url, redirectUrl)) {
      return fetchClaudeCodeNativePage(redirectUrl, maxChars, redirectDepth + 1);
    }
    const content = buildRedirectNotice(url, redirectUrl, response.status);
    return {
      url,
      finalUrl: url,
      contentType: response.headers.get("content-type") ?? undefined,
      content,
      contentChars: content.length,
      truncated: false,
      transport: "redirect_notice",
      status: response.status,
      backend: "anthropic-claude-code-native",
      redirectTarget: redirectUrl,
      errorCode: "redirect_host_change",
    };
  }
  if (!response.ok) {
    throw new SearchFetchExecutionError(
      "search_fetch_http_error",
      `search.fetch received HTTP ${response.status} from ${url}`,
      { fallbackEligible: true, details: { url, status: response.status } },
    );
  }
  const rawContent = await response.text();
  const contentType = response.headers.get("content-type") ?? undefined;
  const normalized = normalizeFetchedContent(rawContent, contentType, maxChars);
  return {
    url,
    finalUrl: url,
    title: normalized.title,
    contentType,
    content: normalized.content,
    contentChars: normalized.contentChars,
    truncated: normalized.truncated,
    transport: "direct",
    status: response.status,
    backend: "anthropic-claude-code-native",
  };
}

async function fetchGeminiNativePage(
  url: string,
  maxChars: number,
  redirectDepth = 0,
): Promise<TapVendorNetworkFetcherResponse> {
  if (redirectDepth >= 10) {
    throw new SearchFetchExecutionError(
      "search_fetch_redirect_limit_exceeded",
      "search.fetch hit the Gemini-style redirect limit.",
      { fallbackEligible: true, details: { url, redirectDepth } },
    );
  }

  await ensureNotDeniedTarget(url, true);
  const response = await fetchResponse(url, "gemini-cli-native", "manual");
  if (isRedirectStatus(response.status)) {
    const location = response.headers.get("location");
    if (!location) {
      throw new SearchFetchExecutionError(
        "search_fetch_redirect_missing_location",
        "search.fetch received a redirect response without a Location header.",
        { fallbackEligible: true, details: { url, status: response.status } },
      );
    }
    const redirectUrl = new URL(location, url).toString();
    await ensureNotDeniedTarget(redirectUrl, true);
    return fetchGeminiNativePage(redirectUrl, maxChars, redirectDepth + 1);
  }
  if (!response.ok) {
    throw new SearchFetchExecutionError(
      "search_fetch_http_error",
      `search.fetch received HTTP ${response.status} from ${url}`,
      { fallbackEligible: true, details: { url, status: response.status } },
    );
  }
  const rawContent = await response.text();
  const contentType = response.headers.get("content-type") ?? undefined;
  const normalized = normalizeFetchedContent(rawContent, contentType, maxChars);
  return {
    url,
    finalUrl: response.url || url,
    title: normalized.title,
    contentType,
    content: normalized.content,
    contentChars: normalized.contentChars,
    truncated: normalized.truncated,
    transport: "direct",
    status: response.status,
    backend: "gemini-cli-native",
  };
}

async function fetchPortablePage(url: string, maxChars: number): Promise<TapVendorNetworkFetcherResponse> {
  await ensureNotDeniedTarget(url, false);
  const directResponse = await fetchResponse(url, "portable-fallback", "follow");
  const finalUrl = directResponse.url || url;
  const contentType = directResponse.headers.get("content-type") ?? undefined;
  const directText = await directResponse.text();

  const shouldFallbackToJina =
    !directResponse.ok
    || isHtmlLikeContentType(contentType)
    || directText.trim().length === 0;

  if (!shouldFallbackToJina) {
    const normalized = normalizeFetchedContent(directText, contentType, maxChars);
    return {
      url,
      finalUrl,
      title: normalized.title,
      contentType,
      content: normalized.content,
      contentChars: normalized.contentChars,
      truncated: normalized.truncated,
      transport: "direct",
      status: directResponse.status,
      backend: "portable-fallback",
    };
  }

  const jinaUrl = `https://r.jina.ai/http://${finalUrl.replace(/^https?:\/\//u, "")}`;
  const jinaResponse = await fetchResponse(jinaUrl, "portable-fallback", "follow");
  if (!jinaResponse.ok) {
    throw new SearchFetchExecutionError(
      "search_fetch_fallback_failed",
      `search.fetch portable fallback failed for ${finalUrl}`,
      { details: { url, finalUrl, status: jinaResponse.status } },
    );
  }
  const jinaText = await jinaResponse.text();
  const normalized = truncateText(jinaText.trim(), maxChars);

  return {
    url,
    finalUrl,
    title: extractTitleFromHtml(directText),
    contentType,
    content: normalized.text,
    contentChars: jinaText.trim().length,
    truncated: normalized.truncated,
    transport: "jina",
    status: jinaResponse.status,
    backend: "portable-fallback",
  };
}

async function executeSearchFetchBackend(
  backend: SearchFetchBackendKind,
  input: SearchFetchExecutionInput,
  backendFetchers: Partial<
    Record<
      SearchFetchBackendKind,
      (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>
    >
  >,
): Promise<TapVendorNetworkFetcherResponse[]> {
  const override = backendFetchers[backend];
  if (override) {
    return override(input);
  }
  const maxChars = input.maxChars ?? 20_000;
  const urls = input.urls.slice(0, 3);
  const pages: TapVendorNetworkFetcherResponse[] = [];
  for (const url of urls) {
    if (backend === "anthropic-claude-code-native") {
      pages.push(await fetchClaudeCodeNativePage(url, maxChars));
    } else if (backend === "gemini-cli-native") {
      pages.push(await fetchGeminiNativePage(url, maxChars));
    } else {
      pages.push(await fetchPortablePage(url, maxChars));
    }
  }
  return pages;
}

async function defaultSearchFetchExecutor(
  input: SearchFetchExecutionInput,
  backendFetchers: Partial<
    Record<
      SearchFetchBackendKind,
      (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>
    >
  > = {},
): Promise<SearchFetchExecutionResult> {
  const selectedBackend = selectSearchFetchBackend(input.route);
  if (selectedBackend === "portable-fallback") {
    const pages = await executeSearchFetchBackend("portable-fallback", input, backendFetchers);
    return {
      pages,
      selectedBackend,
      resolvedBackend: "portable-fallback",
      layer: "portable",
      fallbackApplied: false,
    };
  }

  try {
    const pages = await executeSearchFetchBackend(selectedBackend, input, backendFetchers);
    return {
      pages,
      selectedBackend,
      resolvedBackend: selectedBackend,
      layer: "native",
      fallbackApplied: false,
    };
  } catch (error) {
    if (!(error instanceof SearchFetchExecutionError) || error.fallbackEligible !== true) {
      throw error;
    }
    const pages = (await executeSearchFetchBackend("portable-fallback", input, backendFetchers)).map((page) => ({
      ...page,
      fallbackApplied: true,
    }));
    return {
      pages,
      selectedBackend,
      resolvedBackend: "portable-fallback",
      layer: "portable",
      fallbackApplied: true,
    };
  }
}

function unwrapDuckDuckGoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : url;
  } catch {
    return url;
  }
}

async function defaultSearchWeb(query: string): Promise<PortableSearchResult[]> {
  const searchUrl = `https://r.jina.ai/http://https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const userAgent =
    "Mozilla/5.0 (compatible; Praxis TAP Vendor Network/1.0; +https://github.com/Proview-China/Praxis)";
  const response = await fetch(searchUrl, {
    headers: { "user-agent": userAgent },
    redirect: "follow",
  });
  const searchText = await response.text();
  const pattern = /## \[(?<title>[^\]]+)\]\((?<url>https?:\/\/[^\)]+)\)/gu;
  const seen = new Set<string>();
  const results: PortableSearchResult[] = [];

  for (const match of searchText.matchAll(pattern)) {
    const title = match.groups?.title?.trim();
    const rawUrl = match.groups?.url?.trim();
    if (!title || !rawUrl) {
      continue;
    }
    const url = unwrapDuckDuckGoUrl(rawUrl);
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    results.push({ title, url });
    if (results.length >= 6) {
      break;
    }
  }

  return results;
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const normalizedHost = sanitizeHostname(hostname);
  const normalizedDomain = sanitizeHostname(domain);
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function filterPortableSearchResults(
  results: PortableSearchResult[],
  input: Pick<SearchWebExecutionInput, "allowedDomains" | "blockedDomains">,
): PortableSearchResult[] {
  return results.filter((entry) => {
    try {
      const hostname = new URL(entry.url).hostname;
      if (input.blockedDomains?.some((domain) => hostnameMatchesDomain(hostname, domain))) {
        return false;
      }
      if (input.allowedDomains?.length) {
        return input.allowedDomains.some((domain) => hostnameMatchesDomain(hostname, domain));
      }
      return true;
    } catch {
      return false;
    }
  });
}

function selectPortableSearchTargets(results: PortableSearchResult[]): PortableSearchResult[] {
  const preferred = results.filter((entry) => {
    const lowered = entry.url.toLowerCase();
    return [
      "kitco.com",
      "goldprice.org",
      "livepriceofgold.com",
      "investing.com",
      "goldbroker.com",
    ].some((token) => lowered.includes(token));
  });
  return (preferred.length > 0 ? preferred : results).slice(0, 3);
}

function buildPortableGroundingOutput(
  capabilityKey: "search.web" | "search.ground",
  query: string,
  results: PortableSearchResult[],
  pages: TapVendorNetworkFetcherResponse[],
) {
  const sources = results.map((result, index) => ({
    url: result.url,
    title: result.title,
    snippet: pages[index]?.content.slice(0, 600),
    kind: pages[index] ? "fetched_page" : "search_result",
  }));
  const citations = sources.map((source) => ({
    url: source.url,
    title: source.title,
    snippet: source.snippet,
  }));
  const pageSummary = pages
    .map((page) => {
      const snippet = page.content.replace(/\s+/gu, " ").trim().slice(0, 400);
      const title = page.title ?? page.finalUrl ?? page.url;
      return `${title}: ${snippet}`;
    })
    .join("\n\n");

  if (capabilityKey === "search.ground") {
    return {
      answer: pageSummary || results.map((entry) => `${entry.title} - ${entry.url}`).join("\n"),
      sources,
      citations,
    };
  }

  return {
    query,
    answer: pageSummary,
    sources,
    citations,
  };
}

function isUsefulVendorSearchOutput(output: unknown): boolean {
  const record = asRecord(output);
  if (!record) {
    return false;
  }
  const answer = asString(record.answer);
  const sources = Array.isArray(record.sources) ? record.sources : [];
  const citations = Array.isArray(record.citations) ? record.citations : [];
  return Boolean(answer?.trim()) || sources.length > 0 || citations.length > 0;
}

async function executeSearchWebBackend(
  capabilityKey: "search.web" | "search.ground",
  input: SearchWebExecutionInput,
  facade: TapVendorNetworkFacade,
): Promise<SearchWebExecutionResult> {
  const selectedBackend = selectSearchWebBackend(input.route);
  const shapedInput = shapeSearchInputForBackend(capabilityKey, input, selectedBackend);

  if (selectedBackend === "portable-search-fallback") {
    return {
      selectedBackend,
      resolvedBackend: selectedBackend,
      layer: "portable",
      fallbackApplied: false,
      result: {
        status: "failed",
        provider: shapedInput.route.provider,
        model: shapedInput.route.model,
        layer:
          shapedInput.route.layer === "api" || shapedInput.route.layer === "agent"
            ? shapedInput.route.layer
            : "api",
      },
      normalizedOutput: capabilityKey === "search.ground"
        ? { answer: "", citations: [], sources: [] }
        : { query: shapedInput.query, answer: "", citations: [], sources: [] },
    };
  }

  const result = await facade.websearch.create({
    provider: shapedInput.route.provider,
    model: shapedInput.route.model,
    layer: shapedInput.route.layer,
    variant: shapedInput.route.variant,
    compatibilityProfileId: shapedInput.route.compatibilityProfileId,
    providerOptions: shapedInput.route.providerOptions,
    input: {
      query: shapedInput.query,
      goal: shapedInput.goal,
      urls: shapedInput.urls,
      allowedDomains: shapedInput.allowedDomains,
      blockedDomains: shapedInput.blockedDomains,
      maxSources: shapedInput.maxSources,
      maxOutputTokens: shapedInput.maxOutputTokens,
      searchContextSize: shapedInput.searchContextSize,
      citations: shapedInput.citations,
      freshness: shapedInput.freshness,
      userLocation: shapedInput.userLocation,
    },
  });

  return {
    selectedBackend,
    resolvedBackend: selectedBackend,
    layer: "native",
    fallbackApplied: false,
    normalizedOutput: toSearchWebOutput(capabilityKey, shapedInput, result),
    result,
  };
}

function toSearchWebOutput(
  capabilityKey: "search.web" | "search.ground",
  input: SearchWebExecutionInput,
  result: Awaited<ReturnType<TapVendorNetworkFacade["websearch"]["create"]>>,
) {
  return capabilityKey === "search.ground"
    ? result.output
    : {
        query: input.query,
        answer: result.output?.answer ?? "",
        sources: result.output?.sources ?? [],
        citations: result.output?.citations ?? [],
        provider: result.provider,
        model: result.model,
        layer: result.layer,
      };
}

export class TapVendorNetworkAdapter implements CapabilityAdapter {
  readonly id: string;
  readonly runtimeKind = "tap-vendor-network";
  readonly #capabilityKey: TapVendorNetworkCapabilityKey;
  readonly #facade: TapVendorNetworkFacade;
  readonly #fetcher?: (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>;
  readonly #backendFetchers: Partial<
    Record<
      SearchFetchBackendKind,
      (input: SearchFetchExecutionInput) => Promise<TapVendorNetworkFetcherResponse[]>
    >
  >;
  readonly #preparedStates = new Map<string, PreparedVendorNetworkState>();

  constructor(options: TapVendorNetworkAdapterOptions = {}) {
    this.#capabilityKey = options.capabilityKey ?? "search.ground";
    this.#facade = options.facade ?? {
      websearch: {
        create: rax.websearch.create.bind(rax.websearch),
      },
    };
    this.#fetcher = options.fetcher;
    this.#backendFetchers = options.backendFetchers ?? {};
    this.id = `adapter:${this.#capabilityKey}`;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    return plan.capabilityKey === this.#capabilityKey;
  }

  async prepare(
    plan: CapabilityInvocationPlan,
    lease: CapabilityLease,
  ): Promise<PreparedCapabilityCall> {
    let state: PreparedVendorNetworkState;
    if (this.#capabilityKey === "search.fetch") {
      state = {
        capabilityKey: "search.fetch",
        input: parseSearchFetchInput(plan),
      };
    } else {
      state = {
        capabilityKey: this.#capabilityKey,
        input: parseSearchInput(this.#capabilityKey, plan),
      };
    }

    const fingerprint = buildFingerprint(plan.capabilityKey, state.input);
    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: "direct",
      preparedPayloadRef: `tap-vendor-network:${fingerprint}`,
      cacheKey: lease.preparedCacheKey ?? fingerprint,
      metadata:
        state.capabilityKey === "search.fetch"
          ? { capabilityKey: state.capabilityKey }
          : {
              capabilityKey: state.capabilityKey,
              provider: state.input.route.provider,
              model: state.input.route.model,
            },
    });
    this.#preparedStates.set(prepared.preparedId, state);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#preparedStates.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "tap_vendor_network_prepared_state_missing",
          message: `Prepared vendor-network state for ${prepared.preparedId} was not found.`,
        },
        metadata: {
          capabilityKey: this.#capabilityKey,
          runtimeKind: this.runtimeKind,
        },
      });
    }

    try {
      if (state.capabilityKey === "search.fetch") {
        const fetchResult = this.#fetcher
          ? {
              pages: await this.#fetcher(state.input),
              selectedBackend: selectSearchFetchBackend(state.input.route),
              resolvedBackend: "portable-fallback" as SearchFetchBackendKind,
              layer: "portable" as const,
              fallbackApplied: false,
            }
          : await defaultSearchFetchExecutor(state.input, this.#backendFetchers);
        const pageHasRedirect = fetchResult.pages.some((page) => page.transport === "redirect_notice");
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: pageHasRedirect || fetchResult.fallbackApplied ? "partial" : "success",
          output: {
            prompt: state.input.prompt,
            urlCount: state.input.urls.length,
            selectedBackend: fetchResult.selectedBackend,
            resolvedBackend: fetchResult.resolvedBackend,
            fallbackApplied: fetchResult.fallbackApplied,
            pages: fetchResult.pages,
          },
          evidence: fetchResult.pages.map((page) => ({
            url: page.url,
            finalUrl: page.finalUrl,
            transport: page.transport,
            status: page.status,
            backend: page.backend,
            redirectTarget: page.redirectTarget,
          })),
          metadata: {
            capabilityKey: state.capabilityKey,
            runtimeKind: this.runtimeKind,
            provider: state.input.route?.provider,
            model: state.input.route?.model,
            selectedBackend: fetchResult.selectedBackend,
            resolvedBackend: fetchResult.resolvedBackend,
            layer: fetchResult.layer,
            fallbackApplied: fetchResult.fallbackApplied,
          },
        });
      }

      const execution = await executeSearchWebBackend(
        state.capabilityKey,
        state.input,
        this.#facade,
      );
      const status = mapSearchStatus(execution.result.status);
      const normalizedOutput = execution.normalizedOutput;
      if (
        (status === "failed" || status === "blocked" || status === "timeout" || !isUsefulVendorSearchOutput(normalizedOutput))
      ) {
        try {
          const portableResults = filterPortableSearchResults(
            await defaultSearchWeb(state.input.query),
            state.input,
          );
          const selectedTargets = selectPortableSearchTargets(portableResults);
          const pages = selectedTargets.length > 0
            ? await fetchPortableSearchPages(this.#fetcher, this.#backendFetchers, {
                urls: selectedTargets.map((entry) => entry.url),
                prompt: state.input.goal ?? state.input.query,
                maxChars: 4_000,
              })
            : [];
          const fallbackOutput = buildPortableGroundingOutput(
            state.capabilityKey,
            state.input.query,
            selectedTargets.length > 0 ? selectedTargets : portableResults,
            pages,
          );
          if (isUsefulVendorSearchOutput(fallbackOutput)) {
            return createCapabilityResultEnvelope({
              executionId: prepared.preparedId,
              status: "partial",
              output: fallbackOutput,
              evidence: [
                {
                  fallback: "portable-search",
                  query: state.input.query,
                  resultCount: portableResults.length,
                  pageCount: pages.length,
                },
              ],
              metadata: {
                capabilityKey: state.capabilityKey,
                runtimeKind: this.runtimeKind,
                provider: state.input.route.provider,
                model: state.input.route.model,
                layer: "portable",
                selectedBackend: execution.selectedBackend,
                resolvedBackend: "portable-search-fallback",
                fallbackApplied: true,
              },
            });
          }
        } catch {
          // Keep the original failure envelope below if portable fallback also fails.
        }
      }
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status,
        output: normalizedOutput,
        evidence: execution.result.evidence,
        error:
          status === "failed" || status === "blocked" || status === "timeout"
            ? {
                code: "tap_vendor_network_search_failed",
                message: `${state.capabilityKey} did not complete successfully.`,
                details: asRecord(execution.result.error) ?? { raw: execution.result.error },
              }
            : undefined,
        metadata: {
          capabilityKey: state.capabilityKey,
          runtimeKind: this.runtimeKind,
          provider: execution.result.provider,
          model: execution.result.model,
          layer: execution.layer === "native" ? execution.result.layer : "portable",
          selectedBackend: execution.selectedBackend,
          resolvedBackend: execution.resolvedBackend,
          fallbackApplied: execution.fallbackApplied,
        },
      });
    } catch (error) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code:
            error instanceof SearchFetchExecutionError
              ? error.code
              : "tap_vendor_network_execution_failed",
          message: error instanceof Error ? error.message : String(error),
          details:
            error instanceof SearchFetchExecutionError
              ? error.details
              : undefined,
        },
        metadata: {
          capabilityKey: state.capabilityKey,
          runtimeKind: this.runtimeKind,
        },
      });
    }
  }

  async healthCheck() {
    return {
      status: "healthy",
      adapterId: this.id,
      runtimeKind: this.runtimeKind,
      capabilityKey: this.#capabilityKey,
    };
  }
}

export function createTapVendorNetworkAdapter(
  options: TapVendorNetworkAdapterOptions = {},
): TapVendorNetworkAdapter {
  return new TapVendorNetworkAdapter(options);
}

export function createTapVendorNetworkActivationFactory(
  options: TapVendorNetworkAdapterOptions = {},
): ActivationAdapterFactory {
  return (context) =>
    createTapVendorNetworkAdapter({
      ...options,
      capabilityKey:
        TAP_VENDOR_NETWORK_CAPABILITY_KEYS.includes(
          context.manifest?.capabilityKey as TapVendorNetworkCapabilityKey,
        )
          ? (context.manifest?.capabilityKey as TapVendorNetworkCapabilityKey)
          : options.capabilityKey,
    });
}

export function registerTapVendorNetworkCapabilityFamily(
  input: RegisterTapVendorNetworkCapabilityFamilyInput,
): RegisterTapVendorNetworkCapabilityFamilyResult {
  const capabilityKeys = (input.capabilityKeys ?? TAP_VENDOR_NETWORK_CAPABILITY_KEYS) as
    readonly TapVendorNetworkCapabilityKey[];

  const manifests: CapabilityManifest[] = [];
  const packages: CapabilityPackage[] = [];
  const bindings: unknown[] = [];
  const activationFactoryRefs: string[] = [];

  for (const capabilityKey of capabilityKeys) {
    const capabilityPackage = createTapVendorNetworkCapabilityPackage({
      capabilityKey,
      replayPolicy: input.replayPolicy,
    });
    const manifest = createCapabilityManifestFromPackage(capabilityPackage);
    const activationFactoryRef =
      TAP_VENDOR_NETWORK_ACTIVATION_FACTORY_REFS[capabilityKey];
    const factory = createTapVendorNetworkActivationFactory({
      capabilityKey,
      facade: input.facade,
      fetcher: input.fetcher,
      backendFetchers: input.backendFetchers,
    });

    input.runtime.registerTaActivationFactory(activationFactoryRef, factory);
    const adapter = factory({
      capabilityPackage,
      activationSpec: capabilityPackage.activationSpec!,
      bindingPayload: capabilityPackage.activationSpec?.bindingPayload,
      manifest,
      manifestPayload: capabilityPackage.activationSpec?.manifestPayload,
      metadata: {
        registrationSource: "registerTapVendorNetworkCapabilityFamily",
      },
    });
    const binding = input.runtime.registerCapabilityAdapter(manifest, adapter);

    manifests.push(manifest);
    packages.push(capabilityPackage);
    bindings.push(binding);
    activationFactoryRefs.push(activationFactoryRef);
  }

  return {
    capabilityKeys: [...capabilityKeys],
    activationFactoryRefs,
    manifests,
    packages,
    bindings,
  };
}
