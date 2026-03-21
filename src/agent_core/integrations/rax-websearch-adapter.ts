import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import { buildCapabilityInvocationFingerprint } from "../capability-invocation/capability-plan.js";
import { createPreparedCapabilityCall } from "../capability-invocation/capability-execution.js";
import type {
  ProviderId,
  SdkLayer,
  WebSearchCreateInput,
  WebSearchOutput,
} from "../../rax/index.js";
import type { SearchCapabilityKey } from "../../rax/websearch-types.js";
import {
  isSearchCapabilityKey,
  resolveSearchCapabilityKey,
  searchCapabilityAction
} from "../../rax/websearch-types.js";
import { rax } from "../../rax/index.js";

export interface RaxWebsearchInvocationInput extends WebSearchCreateInput {
  capabilityKey: SearchCapabilityKey;
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
  providerOptions?: Partial<Record<ProviderId, Record<string, unknown>>>;
}

export interface RaxWebsearchAdapterOptions {
  facade?: WebsearchFacade;
  capabilityKey?: SearchCapabilityKey;
}

interface WebsearchFacade {
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
    prepare?(options: unknown): unknown;
    [key: string]: unknown;
  };
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : undefined;
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

function parseWebsearchInput(plan: CapabilityInvocationPlan): RaxWebsearchInvocationInput {
  const input = plan.input;
  const capabilityKey = isSearchCapabilityKey(plan.capabilityKey)
    ? plan.capabilityKey
    : resolveSearchCapabilityKey(asString(input.capabilityKey));
  const provider = asString(input.provider) as ProviderId | undefined;
  const model = asString(input.model);
  const query = asString(input.query);

  if (!provider) {
    throw new Error(`${capabilityKey} invocation is missing provider.`);
  }

  if (!model) {
    throw new Error(`${capabilityKey} invocation is missing model.`);
  }

  if (!query) {
    throw new Error(`${capabilityKey} invocation is missing query.`);
  }

  return {
    capabilityKey,
    provider,
    model,
    query,
    goal: asString(input.goal),
    urls: asStringArray(input.urls),
    allowedDomains: asStringArray(input.allowedDomains),
    blockedDomains: asStringArray(input.blockedDomains),
    maxSources: typeof input.maxSources === "number" ? input.maxSources : undefined,
    maxOutputTokens: typeof input.maxOutputTokens === "number" ? input.maxOutputTokens : undefined,
    searchContextSize:
      input.searchContextSize === "low" || input.searchContextSize === "medium" || input.searchContextSize === "high"
        ? input.searchContextSize
        : undefined,
    citations:
      input.citations === "required" || input.citations === "preferred" || input.citations === "off"
        ? input.citations
        : undefined,
    freshness:
      input.freshness === "any" ||
      input.freshness === "day" ||
      input.freshness === "week" ||
      input.freshness === "month" ||
      input.freshness === "year"
        ? input.freshness
        : undefined,
    userLocation: asObject(input.userLocation) as WebSearchCreateInput["userLocation"] | undefined,
    layer:
      input.layer === "api" || input.layer === "agent" || input.layer === "auto"
        ? input.layer
        : undefined,
    variant: asString(input.variant),
    compatibilityProfileId: asString(input.compatibilityProfileId),
    providerOptions: asObject(input.providerOptions) as RaxWebsearchInvocationInput["providerOptions"] | undefined,
  };
}

export class RaxWebsearchAdapter implements CapabilityAdapter {
  readonly id: string;
  readonly runtimeKind = "rax-search";
  readonly #facade: WebsearchFacade;
  readonly #capabilityKey: SearchCapabilityKey;
  readonly #supportedCapabilityKeys: ReadonlySet<SearchCapabilityKey>;
  readonly #preparedInputs = new Map<string, RaxWebsearchInvocationInput>();

  constructor(options: RaxWebsearchAdapterOptions = {}) {
    this.#facade = options.facade ?? {
      websearch: {
        create: rax.websearch.create.bind(rax.websearch),
      },
    };
    this.#capabilityKey = resolveSearchCapabilityKey(options.capabilityKey);
    this.#supportedCapabilityKeys = options.capabilityKey
      ? new Set([this.#capabilityKey])
      : new Set<SearchCapabilityKey>(["search.web", "search.ground"]);
    this.id = options.capabilityKey ? `adapter:${this.#capabilityKey}` : "adapter:search";
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    return isSearchCapabilityKey(plan.capabilityKey)
      && this.#supportedCapabilityKeys.has(plan.capabilityKey);
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const parsedInput = parseWebsearchInput(plan);
    const fingerprint = buildCapabilityInvocationFingerprint({
      capabilityKey: plan.capabilityKey,
      operation: plan.operation,
      input: {
        query: parsedInput.query,
        goal: parsedInput.goal,
        urls: parsedInput.urls,
        allowedDomains: parsedInput.allowedDomains,
        blockedDomains: parsedInput.blockedDomains,
        maxSources: parsedInput.maxSources,
        maxOutputTokens: parsedInput.maxOutputTokens,
        searchContextSize: parsedInput.searchContextSize,
        citations: parsedInput.citations,
        freshness: parsedInput.freshness,
      },
      timeoutMs: plan.timeoutMs,
      priority: plan.priority,
    });

    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: "direct",
      preparedPayloadRef: `rax-search:${fingerprint}`,
      cacheKey: lease.preparedCacheKey ?? fingerprint,
      metadata: {
        capabilityKey: parsedInput.capabilityKey,
        provider: parsedInput.provider,
        model: parsedInput.model,
      },
    });

    this.#preparedInputs.set(prepared.preparedId, parsedInput);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const input = this.#preparedInputs.get(prepared.preparedId);
    if (!input) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "rax_search_prepared_input_missing",
          message: `Prepared search input for ${prepared.preparedId} was not found.`,
        },
        metadata: {
          capabilityKey: prepared.capabilityKey,
          runtimeKind: this.runtimeKind,
          compatibilityLayer: "rax.websearch",
        },
      });
    }

    const capabilityResult = await this.#facade.websearch.create({
      provider: input.provider,
      model: input.model,
      layer: input.layer,
      variant: input.variant,
      compatibilityProfileId: input.compatibilityProfileId,
      providerOptions: input.providerOptions,
      input: {
        capabilityKey: input.capabilityKey,
        query: input.query,
        goal: input.goal,
        urls: input.urls,
        allowedDomains: input.allowedDomains,
        blockedDomains: input.blockedDomains,
        maxSources: input.maxSources,
        maxOutputTokens: input.maxOutputTokens,
        searchContextSize: input.searchContextSize,
        citations: input.citations,
        freshness: input.freshness,
        userLocation: input.userLocation,
      },
    });

    const status = mapSearchStatus(capabilityResult.status);
    const action = searchCapabilityAction(input.capabilityKey);
    const output = capabilityResult.output
      ? {
          ...capabilityResult.output,
          capabilityKey: input.capabilityKey,
        }
      : undefined;
    const evidence = Array.isArray(capabilityResult.evidence)
      ? capabilityResult.evidence.map((entry) => {
          const normalizedEntry = asObject(entry);

          return normalizedEntry
            ? {
                ...normalizedEntry,
                capabilityKey: input.capabilityKey,
              }
            : entry;
        })
      : capabilityResult.evidence;

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status,
      output: output as WebSearchOutput | undefined,
      evidence,
      error:
        status === "failed" || status === "blocked" || status === "timeout"
          ? {
              code: "rax_search_failed",
              message: `Rax ${input.capabilityKey} did not complete successfully.`,
              details: asObject(capabilityResult.error) ?? { raw: capabilityResult.error },
            }
          : undefined,
      metadata: {
        capabilityKey: input.capabilityKey,
        action,
        runtimeKind: this.runtimeKind,
        provider: capabilityResult.provider,
        model: capabilityResult.model,
        layer: capabilityResult.layer,
        compatibilityLayer: "rax.websearch",
      },
    });
  }

  async healthCheck() {
    return {
      status: "healthy",
      adapterId: this.id,
      runtimeKind: this.runtimeKind,
    };
  }
}

export function createRaxWebsearchAdapter(
  options: RaxWebsearchAdapterOptions = {},
): RaxWebsearchAdapter {
  return new RaxWebsearchAdapter(options);
}
