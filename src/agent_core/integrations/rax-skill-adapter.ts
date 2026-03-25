import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityResultEnvelope,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import { rax } from "../../rax/index.js";
import type {
  ProviderId,
  SdkLayer,
  SkillActivationPlan,
  SkillContainer,
  SkillMountInput,
  SkillMountResult,
  SkillUseInput,
  SkillUseResult,
} from "../../rax/index.js";
import type { PreparedInvocation } from "../../rax/contracts.js";

export const RAX_SKILL_ADAPTER_CAPABILITY_KEYS = [
  "skill.use",
  "skill.mount",
  "skill.prepare",
] as const;

export type RaxSkillAdapterCapabilityKey =
  (typeof RAX_SKILL_ADAPTER_CAPABILITY_KEYS)[number];

interface SkillFacade {
  skill: {
    use(options: {
      provider: ProviderId;
      model: string;
      layer?: SdkLayer;
      variant?: string;
      compatibilityProfileId?: string;
      input: SkillUseInput;
    }): Promise<SkillUseResult>;
    mount(options: {
      provider: ProviderId;
      model: string;
      layer?: SdkLayer;
      variant?: string;
      compatibilityProfileId?: string;
      input: SkillMountInput;
    }): SkillMountResult;
    prepare(options: {
      provider: ProviderId;
      model: string;
      layer?: SdkLayer;
      variant?: string;
      compatibilityProfileId?: string;
      input: {
        container: SkillContainer;
        includeResources?: boolean;
        includeHelpers?: boolean;
      };
    }): PreparedInvocation<Record<string, unknown>>;
  };
}

interface RaxSkillRouteContext {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
}

interface PreparedSkillExecutionState {
  action: RaxSkillAdapterCapabilityKey;
  route: RaxSkillRouteContext;
  input: SkillUseInput | SkillMountInput | {
    container: SkillContainer;
    includeResources?: boolean;
    includeHelpers?: boolean;
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
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

function isProviderId(value: unknown): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "deepmind";
}

function isSdkLayer(value: unknown): value is SdkLayer {
  return value === "api" || value === "agent" || value === "auto";
}

function parseRouteContext(input: Record<string, unknown>): RaxSkillRouteContext {
  const route = asRecord(input.route);
  const provider = (route?.provider ?? input.provider);
  const model = asString(route?.model ?? input.model);
  const layer = route?.layer ?? input.layer;
  const variant = asString(route?.variant ?? input.variant);
  const compatibilityProfileId = asString(
    route?.compatibilityProfileId ?? input.compatibilityProfileId,
  );

  if (!isProviderId(provider)) {
    throw new Error("skill adapter input is missing a valid provider.");
  }
  if (!model) {
    throw new Error("skill adapter input is missing model.");
  }

  return {
    provider,
    model,
    layer: isSdkLayer(layer) ? layer : undefined,
    variant,
    compatibilityProfileId,
  };
}

function parseSkillUseInput(input: Record<string, unknown>): SkillUseInput {
  const container = asRecord(input.container) as SkillContainer | undefined;
  const reference = asRecord(input.reference);
  const source = asString(input.source);
  if (!source && !container && !reference) {
    throw new Error("skill.use adapter input requires source, container, or reference.");
  }

  if (container) {
    return {
      container,
      mode: asString(input.mode) as SkillUseInput["mode"] | undefined,
      layer: isSdkLayer(input.layer) && input.layer !== "auto" ? input.layer : undefined,
      includeResources: asBoolean(input.includeResources),
      includeHelpers: asBoolean(input.includeHelpers),
      details: asRecord(input.details) as SkillUseInput["details"] | undefined,
    };
  }

  if (reference) {
    const referenceId = asString(reference.id);
    if (!referenceId) {
      throw new Error("skill.use adapter reference input is missing id.");
    }

    return {
      reference: {
        id: referenceId,
        name: asString(reference.name),
        description: asString(reference.description),
        version: asString(reference.version),
        tags: Array.isArray(reference.tags) ? reference.tags.map(String) : undefined,
        triggers: Array.isArray(reference.triggers) ? reference.triggers.map(String) : undefined,
        frontmatter: asRecord(reference.frontmatter),
      },
      mode: asString(input.mode) as SkillUseInput["mode"] | undefined,
      layer: isSdkLayer(input.layer) && input.layer !== "auto" ? input.layer : undefined,
      includeResources: asBoolean(input.includeResources),
      includeHelpers: asBoolean(input.includeHelpers),
      policy: asRecord(input.policy) as Record<string, unknown> | undefined,
      loading: asRecord(input.loading) as Record<string, unknown> | undefined,
      details: asRecord(input.details) as SkillUseInput["details"] | undefined,
    };
  }

  const sourceInput = input as Record<string, unknown> & {
    descriptor?: unknown;
    policy?: unknown;
    loading?: unknown;
  };

  return {
    source: source!,
    mode: asString(input.mode) as SkillUseInput["mode"] | undefined,
    layer: isSdkLayer(input.layer) && input.layer !== "auto" ? input.layer : undefined,
    includeResources: asBoolean(input.includeResources),
    includeHelpers: asBoolean(input.includeHelpers),
    descriptor: asRecord(sourceInput.descriptor) as Record<string, unknown> | undefined,
    policy: asRecord(sourceInput.policy) as Record<string, unknown> | undefined,
    loading: asRecord(sourceInput.loading) as Record<string, unknown> | undefined,
    details: asRecord(input.details) as SkillUseInput["details"] | undefined,
  };
}

function parseSkillMountInput(input: Record<string, unknown>): SkillMountInput {
  const container = asRecord(input.container) as SkillContainer | undefined;
  if (!container) {
    throw new Error("skill.mount adapter input is missing container.");
  }

  return {
    container,
    includeResources: asBoolean(input.includeResources),
    includeHelpers: asBoolean(input.includeHelpers),
  };
}

function parseSkillPrepareInput(input: Record<string, unknown>): {
  container: SkillContainer;
  includeResources?: boolean;
  includeHelpers?: boolean;
} {
  const container = asRecord(input.container) as SkillContainer | undefined;
  if (!container) {
    throw new Error("skill.prepare adapter input is missing container.");
  }

  return {
    container,
    includeResources: asBoolean(input.includeResources),
    includeHelpers: asBoolean(input.includeHelpers),
  };
}

function summarizeContainer(container: SkillContainer) {
  return {
    id: container.descriptor.id,
    name: container.descriptor.name,
    version: container.descriptor.version,
    tags: container.descriptor.tags,
    triggers: container.descriptor.triggers,
    source: {
      kind: container.source.kind,
      rootDir: container.source.rootDir,
      entryPath: container.source.entryPath,
    },
  };
}

function summarizeActivation(activation: SkillActivationPlan) {
  return {
    provider: activation.provider,
    mode: activation.mode,
    layer: activation.layer,
    officialCarrier: activation.officialCarrier,
    composeStrategy: activation.composeStrategy ?? "runtime-only",
    composeNotes: activation.composeNotes,
    entryPath: activation.entry.path,
    resourceCount: activation.resources?.length ?? 0,
    helperCount: activation.helpers?.length ?? 0,
  };
}

function summarizePreparedInvocation(invocation: PreparedInvocation<Record<string, unknown>>) {
  return {
    key: invocation.key,
    provider: invocation.provider,
    model: invocation.model,
    layer: invocation.layer,
    variant: invocation.variant,
  };
}

function toSuccessEnvelope(params: {
  executionId: string;
  prepared: PreparedCapabilityCall;
  output: unknown;
  metadata?: Record<string, unknown>;
}): CapabilityResultEnvelope {
  return {
    executionId: params.executionId,
    resultId: params.prepared.preparedId,
    status: "success",
    output: params.output,
    completedAt: new Date().toISOString(),
    metadata: {
      capabilityKey: params.prepared.capabilityKey,
      adapterId: "rax.skill.adapter",
      ...(params.metadata ?? {}),
    },
  };
}

export class RaxSkillCapabilityAdapter implements CapabilityAdapter {
  readonly id = "rax.skill.adapter";
  readonly runtimeKind = "rax-skill";
  readonly #facade: SkillFacade;
  readonly #prepared = new Map<string, PreparedSkillExecutionState>();

  constructor(facade: SkillFacade = rax) {
    this.#facade = facade;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (!RAX_SKILL_ADAPTER_CAPABILITY_KEYS.includes(plan.capabilityKey as RaxSkillAdapterCapabilityKey)) {
      return false;
    }

    try {
      const input = asRecord(plan.input) ?? {};
      if (plan.capabilityKey === "skill.use") {
        parseRouteContext(input);
        parseSkillUseInput(input);
        return true;
      }
      if (plan.capabilityKey === "skill.mount") {
        parseRouteContext(input);
        parseSkillMountInput(input);
        return true;
      }
      if (plan.capabilityKey === "skill.prepare") {
        parseRouteContext(input);
        parseSkillPrepareInput(input);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  async prepare(
    plan: CapabilityInvocationPlan,
    lease: CapabilityLease,
  ): Promise<PreparedCapabilityCall> {
    const input = asRecord(plan.input) ?? {};
    const route = parseRouteContext(input);
    const action = plan.capabilityKey as RaxSkillAdapterCapabilityKey;

    const parsedInput =
      action === "skill.use"
        ? parseSkillUseInput(input)
        : action === "skill.mount"
          ? parseSkillMountInput(input)
          : parseSkillPrepareInput(input);

    const prepared = createPreparedCapabilityCall({
      preparedId: `${plan.planId}:skill`,
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `rax.skill:${action}:${plan.planId}`,
      cacheKey:
        lease.preparedCacheKey
        ?? stableStringify({
          capabilityKey: plan.capabilityKey,
          operation: plan.operation,
          input: plan.input,
          timeoutMs: plan.timeoutMs ?? null,
          priority: plan.priority,
        }),
    });

    this.#prepared.set(prepared.preparedId, {
      action,
      route,
      input: parsedInput,
    });

    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall): Promise<CapabilityResultEnvelope> {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      throw new Error(`Prepared skill call ${prepared.preparedId} was not found.`);
    }

    const executionId = prepared.preparedId;
    const routeOptions = {
      provider: state.route.provider,
      model: state.route.model,
      layer: state.route.layer,
      variant: state.route.variant,
      compatibilityProfileId: state.route.compatibilityProfileId,
    };

    if (state.action === "skill.use") {
      const result = await this.#facade.skill.use({
        ...routeOptions,
        input: state.input as SkillUseInput,
      });
      return toSuccessEnvelope({
        executionId,
        prepared,
        output: summarizeSkillUseResult(result),
        metadata: {
          progressiveLoading: {
            includeResources: (state.input as SkillUseInput).includeResources ?? false,
            includeHelpers: (state.input as SkillUseInput).includeHelpers ?? false,
          },
        },
      });
    }

    if (state.action === "skill.mount") {
      const result = this.#facade.skill.mount({
        ...routeOptions,
        input: state.input as SkillMountInput,
      });
      return toSuccessEnvelope({
        executionId,
        prepared,
        output: summarizeSkillMountResult(result),
      });
    }

    const result = this.#facade.skill.prepare({
      ...routeOptions,
      input: state.input as {
        container: SkillContainer;
        includeResources?: boolean;
        includeHelpers?: boolean;
      },
    });

    return toSuccessEnvelope({
      executionId,
      prepared,
      output: {
        action: "skill.prepare",
        container: summarizeContainer((state.input as { container: SkillContainer }).container),
        preparedInvocation: summarizePreparedInvocation(result),
      },
      metadata: {
        progressiveLoading: {
          includeResources: (state.input as { includeResources?: boolean }).includeResources ?? false,
          includeHelpers: (state.input as { includeHelpers?: boolean }).includeHelpers ?? false,
        },
      },
    });
  }

  async healthCheck(): Promise<unknown> {
    return {
      status: "healthy",
      supportedActions: [...RAX_SKILL_ADAPTER_CAPABILITY_KEYS],
    };
  }
}

function summarizeSkillUseResult(result: SkillUseResult) {
  return {
    action: "skill.use",
    container: summarizeContainer(result.container),
    activation: summarizeActivation(result.activation),
    preparedInvocation: summarizePreparedInvocation(result.invocation),
  };
}

function summarizeSkillMountResult(result: SkillMountResult) {
  return {
    action: "skill.mount",
    container: summarizeContainer(result.container),
    activation: summarizeActivation(result.activation),
    preparedInvocation: summarizePreparedInvocation(result.invocation),
  };
}

export function createRaxSkillCapabilityAdapter(
  facade: SkillFacade = rax,
): RaxSkillCapabilityAdapter {
  return new RaxSkillCapabilityAdapter(facade);
}
