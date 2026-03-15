export const PROVIDERS = ["openai", "anthropic", "deepmind"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const CAPABILITY_PLANES = [
  "inference",
  "tool",
  "resource",
  "runtime"
] as const;
export type CapabilityPlane = (typeof CAPABILITY_PLANES)[number];

export const SUPPORT_POOLS = ["core", "shared", "provider"] as const;
export type SupportPool = (typeof SUPPORT_POOLS)[number];

export const CAPABILITY_WEIGHTS = ["thin", "thick"] as const;
export type CapabilityWeight = (typeof CAPABILITY_WEIGHTS)[number];

export const SDK_LAYERS = ["api", "agent", "auto"] as const;
export type SdkLayer = (typeof SDK_LAYERS)[number];

export const SUPPORT_STATUSES = [
  "documented",
  "inferred",
  "unconfirmed",
  "unsupported"
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const CAPABILITY_NAMESPACES = [
  "generate",
  "embed",
  "tool",
  "mcp",
  "search",
  "code",
  "computer",
  "shell",
  "session",
  "agent",
  "file",
  "batch",
  "trace"
] as const;
export type CapabilityNamespace = (typeof CAPABILITY_NAMESPACES)[number];

export const CAPABILITY_ACTIONS = [
  "create",
  "stream",
  "live",
  "structure",
  "define",
  "list",
  "call",
  "result",
  "connect",
  "listTools",
  "listResources",
  "readResource",
  "listPrompts",
  "getPrompt",
  "listConnections",
  "disconnect",
  "disconnectAll",
  "serve",
  "web",
  "fetch",
  "ground",
  "run",
  "patch",
  "sandbox",
  "use",
  "observe",
  "act",
  "approve",
  "open",
  "resume",
  "fork",
  "compact",
  "close",
  "delegate",
  "handoff",
  "asTool",
  "upload",
  "read",
  "remove",
  "submit",
  "status",
  "cancel",
  "start",
  "span",
  "event",
  "end"
] as const;
export type CapabilityAction = (typeof CAPABILITY_ACTIONS)[number];

export type CapabilityKey = `${CapabilityNamespace}.${CapabilityAction}`;

export interface ProviderCapabilitySupport {
  status: SupportStatus;
  preferredLayer?: Exclude<SdkLayer, "auto">;
  notes?: string;
}

export interface CapabilityDefinition {
  key: CapabilityKey;
  namespace: CapabilityNamespace;
  action: CapabilityAction;
  plane: CapabilityPlane;
  pool: SupportPool;
  weight: CapabilityWeight;
  defaultLayer: SdkLayer;
  description: string;
  providerSupport: Record<ProviderId, ProviderCapabilitySupport>;
}

export interface CapabilityRequest<TInput = unknown> {
  provider: ProviderId;
  model: string;
  layer?: SdkLayer;
  variant?: string;
  compatibilityProfileId?: string;
  capability: CapabilityNamespace;
  action: CapabilityAction;
  input: TInput;
  session?: unknown;
  tools?: unknown[];
  policy?: unknown;
  metadata?: Record<string, unknown>;
  providerOptions?: Partial<Record<ProviderId, Record<string, unknown>>>;
}

export interface CapabilityResult<TOutput = unknown> {
  status: "queued" | "running" | "success" | "partial" | "failed" | "blocked" | "timeout";
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  variant?: string;
  compatibilityProfileId?: string;
  capability: CapabilityNamespace;
  action: CapabilityAction;
  output?: TOutput;
  artifacts?: unknown[];
  usage?: unknown;
  evidence?: unknown[];
  error?: unknown;
  handoff?: unknown;
}
