import type { CapabilityAdapterDescriptor, FacadeCallOptions, PreparedInvocation } from "./contracts.js";
import { MissingAdapterError, UnsupportedCapabilityError } from "./errors.js";
import { getCapabilityDefinition } from "./registry.js";
import type {
  CapabilityAction,
  CapabilityKey,
  CapabilityNamespace,
  CapabilityRequest,
  ProviderId,
  SdkLayer
} from "./types.js";

function buildCapabilityKey(
  capability: CapabilityNamespace,
  action: CapabilityAction
): CapabilityKey {
  return `${capability}.${action}` as CapabilityKey;
}

export class CapabilityRouter {
  readonly #adapters: readonly CapabilityAdapterDescriptor[];

  constructor(adapters: readonly CapabilityAdapterDescriptor[]) {
    this.#adapters = adapters;
  }

  listAdapters(): readonly CapabilityAdapterDescriptor[] {
    return this.#adapters;
  }

  resolveAdapter(
    provider: ProviderId,
    capability: CapabilityNamespace,
    action: CapabilityAction,
    layer: SdkLayer = "auto",
    variant?: string
  ): CapabilityAdapterDescriptor {
    const key = buildCapabilityKey(capability, action);
    const definition = getCapabilityDefinition(key);

    if (!definition) {
      throw new MissingAdapterError(
        key,
        provider,
        layer,
        `No capability definition is registered for ${key}.`
      );
    }

    const support = definition.providerSupport[provider];
    if (support.status === "unsupported") {
      throw new UnsupportedCapabilityError(
        key,
        provider,
        `${provider} does not support ${key} in the current capability matrix.`
      );
    }

    const effectiveLayer = layer === "auto"
      ? support.preferredLayer ?? (definition.defaultLayer === "auto" ? "api" : definition.defaultLayer)
      : layer;

    const adapter = variant !== undefined
      ? this.#adapters.find((candidate) => {
          return (
            candidate.provider === provider &&
            candidate.key === key &&
            candidate.layer === effectiveLayer &&
            candidate.variant === variant
          );
        })
      : this.#adapters.find((candidate) => {
          return (
            candidate.provider === provider &&
            candidate.key === key &&
            candidate.layer === effectiveLayer &&
            candidate.variant === undefined
          );
        });

    if (!adapter) {
      throw new MissingAdapterError(
        key,
        provider,
        effectiveLayer,
        `No adapter is registered for ${provider} ${key} on layer ${effectiveLayer}${variant ? ` with variant ${variant}` : ""}.`
      );
    }

    return adapter;
  }

  prepare<TInput, TPayload>(
    request: CapabilityRequest<TInput>
  ): PreparedInvocation<TPayload> {
    const adapter = this.resolveAdapter(
      request.provider,
      request.capability,
      request.action,
      request.layer ?? "auto",
      request.variant
    ) as CapabilityAdapterDescriptor<TInput, TPayload>;

    const support = getCapabilityDefinition(adapter.key)?.providerSupport[request.provider];
    const layer = request.layer === "auto" || request.layer === undefined
      ? support?.preferredLayer ?? adapter.layer
      : request.layer;

    return adapter.prepare({
      ...request,
      layer
    });
  }
}

export function createCapabilityRequest<TInput>(
  capability: CapabilityNamespace,
  action: CapabilityAction,
  options: FacadeCallOptions<TInput>
): CapabilityRequest<TInput> {
  return {
    provider: options.provider,
    model: options.model,
    layer: options.layer ?? "auto",
    variant: options.variant,
    compatibilityProfileId: options.compatibilityProfileId,
    capability,
    action,
    input: options.input,
    session: options.session,
    tools: options.tools,
    policy: options.policy,
    metadata: options.metadata,
    providerOptions: options.providerOptions
  };
}
