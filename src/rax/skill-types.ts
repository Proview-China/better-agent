import type { ProviderId, SdkLayer } from "./types.js";
import type { PreparedInvocation } from "./contracts.js";
import type {
  AnthropicApiSkillActivationPayload,
  AnthropicFilesystemSkillBinding,
  AnthropicFilesystemSkillBindingOverrides,
  AnthropicManagedSkillBinding,
  AnthropicManagedSkillBindingOverrides,
  AnthropicManagedSkillReference,
  AnthropicSdkSkillActivationPayload
} from "../integrations/anthropic/api/tools/skills/carrier.js";
import type {
  DeepMindCodeDefinedSkillReference,
  DeepMindCodeDefinedSkillReferenceOverrides,
  DeepMindLocalSkillReference,
  DeepMindLocalSkillReferenceOverrides,
  DeepMindSkillToolsetPayload
} from "../integrations/deepmind/api/tools/skills/carrier.js";
import type {
  OpenAIHostedShellSkillLifecycle,
  OpenAIHostedShellSkillLifecycleOverrides,
  OpenAIHostedShellSkillReference,
  OpenAIInlineShellSkillDefinition,
  OpenAIInlineShellSkillOverrides,
  OpenAILocalShellSkillReference,
  OpenAILocalShellSkillReferenceOverrides,
  OpenAIShellToolPayload
} from "../integrations/openai/api/tools/skills/carrier.js";

export type SkillSourceKind = "local" | "virtual";

export interface SkillSourceRef {
  kind: SkillSourceKind;
  rootDir: string;
  entryPath: string;
}

export interface SkillDescriptor {
  id: string;
  name: string;
  description: string;
  version?: string;
  tags: string[];
  triggers: string[];
  source: SkillSourceRef;
  frontmatter?: Record<string, unknown>;
}

export interface SkillEntryDocument {
  path: string;
  content: string;
}

export type SkillResourceKind =
  | "reference"
  | "example"
  | "template"
  | "asset"
  | "other";

export type SkillHelperKind =
  | "script"
  | "validator"
  | "other";

export interface SkillResourceFile {
  path: string;
  relativePath: string;
  kind: SkillResourceKind;
}

export interface SkillHelperFile {
  path: string;
  relativePath: string;
  kind: SkillHelperKind;
}

export interface SkillExecutionPolicy {
  invocationMode: "auto" | "manual";
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  sourceTrust: "local" | "trusted-registry" | "third-party" | "unknown";
}

export interface SkillLoadingPolicy {
  metadata: "always";
  entry: "on-activate";
  resources: "on-demand";
  helpers: "on-demand";
}

export interface SkillLedger {
  discoverCount: number;
  activationCount: number;
  lastActivatedAt?: string;
}

export type SkillBindingMode =
  | "openai-local-shell"
  | "openai-inline-shell"
  | "openai-hosted-shell"
  | "anthropic-sdk-filesystem"
  | "anthropic-api-managed"
  | "google-adk-local"
  | "google-adk-code-defined";

export type SkillComposeStrategy = "payload-merge" | "runtime-only";

type LooseRecord<T> = T | Record<string, unknown>;

export interface OpenAILocalSkillProviderBinding {
  provider: ProviderId;
  mode: "openai-local-shell";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<OpenAILocalShellSkillReference>;
}

export interface OpenAIHostedSkillProviderBinding {
  provider: ProviderId;
  mode: "openai-hosted-shell";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<OpenAIHostedShellSkillLifecycle>;
}

export interface OpenAIInlineSkillProviderBinding {
  provider: ProviderId;
  mode: "openai-inline-shell";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<OpenAIInlineShellSkillDefinition>;
}

export interface AnthropicSdkSkillProviderBinding {
  provider: ProviderId;
  mode: "anthropic-sdk-filesystem";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<AnthropicFilesystemSkillBinding>;
}

export interface AnthropicApiSkillProviderBinding {
  provider: ProviderId;
  mode: "anthropic-api-managed";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<AnthropicManagedSkillBinding>;
}

export interface DeepMindLocalSkillProviderBinding {
  provider: ProviderId;
  mode: "google-adk-local";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<DeepMindLocalSkillReference>;
}

export interface DeepMindCodeDefinedSkillProviderBinding {
  provider: ProviderId;
  mode: "google-adk-code-defined";
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown> & LooseRecord<DeepMindCodeDefinedSkillReference>;
}

export type SkillProviderBinding =
  | OpenAILocalSkillProviderBinding
  | OpenAIInlineSkillProviderBinding
  | OpenAIHostedSkillProviderBinding
  | AnthropicSdkSkillProviderBinding
  | AnthropicApiSkillProviderBinding
  | DeepMindLocalSkillProviderBinding
  | DeepMindCodeDefinedSkillProviderBinding;

export type SkillBindingDetails =
  SkillProviderBinding["details"];

export type SkillBindingDetailsInput =
  | OpenAILocalShellSkillReferenceOverrides
  | OpenAIInlineShellSkillOverrides
  | OpenAIHostedShellSkillLifecycleOverrides
  | AnthropicFilesystemSkillBindingOverrides
  | AnthropicManagedSkillBindingOverrides
  | DeepMindLocalSkillReferenceOverrides
  | DeepMindCodeDefinedSkillReferenceOverrides;

export interface SkillContainer {
  descriptor: SkillDescriptor;
  source: SkillSourceRef;
  entry: SkillEntryDocument;
  resources: SkillResourceFile[];
  helpers: SkillHelperFile[];
  bindings: Partial<Record<ProviderId, SkillProviderBinding>>;
  policy: SkillExecutionPolicy;
  loading: SkillLoadingPolicy;
  ledger: SkillLedger;
  frontmatter?: Record<string, unknown>;
}

export interface SkillLocalPackage {
  descriptor: SkillDescriptor;
  source: SkillSourceRef;
  entry: SkillEntryDocument;
  resources: SkillResourceFile[];
  helpers: SkillHelperFile[];
  frontmatter?: Record<string, unknown>;
}

export interface SkillLoadLocalInput {
  source: string;
}

export interface SkillReferenceInput {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  tags?: string[];
  triggers?: string[];
  frontmatter?: Record<string, unknown>;
}

export interface SkillContainerCreateInput extends SkillLoadLocalInput {
  descriptor?: Partial<Pick<SkillDescriptor, "id" | "version" | "tags" | "triggers">>;
  policy?: Partial<SkillExecutionPolicy>;
  loading?: Partial<SkillLoadingPolicy>;
}

export interface SkillDefineInput {
  package: SkillLocalPackage;
  descriptor?: Partial<Pick<SkillDescriptor, "id" | "version" | "tags" | "triggers">>;
  policy?: Partial<SkillExecutionPolicy>;
  loading?: Partial<SkillLoadingPolicy>;
}

export interface SkillDiscoverInput {
  sources: string[];
}

export interface SkillBindInput {
  container: SkillContainer;
  provider: ProviderId;
  mode?: SkillBindingMode;
  layer?: Exclude<SdkLayer, "auto">;
  details?: SkillBindingDetailsInput;
}

export interface SkillActivationPlanBase {
  provider: ProviderId;
  mode: SkillBindingMode;
  layer?: Exclude<SdkLayer, "auto">;
  entry: SkillEntryDocument;
  resources?: SkillResourceFile[];
  helpers?: SkillHelperFile[];
  composeStrategy?: SkillComposeStrategy;
  composeNotes?: string;
}

export interface OpenAISkillActivationPlan extends SkillActivationPlanBase {
  provider: ProviderId;
  mode: "openai-local-shell" | "openai-inline-shell" | "openai-hosted-shell";
  officialCarrier: "openai-shell-environment";
  payload: Record<string, unknown> & LooseRecord<OpenAIShellToolPayload>;
}

export interface AnthropicSdkSkillActivationPlan extends SkillActivationPlanBase {
  provider: ProviderId;
  mode: "anthropic-sdk-filesystem";
  officialCarrier: "anthropic-sdk-filesystem-skill";
  payload: Record<string, unknown> & LooseRecord<AnthropicSdkSkillActivationPayload>;
}

export interface AnthropicApiSkillActivationPlan extends SkillActivationPlanBase {
  provider: ProviderId;
  mode: "anthropic-api-managed";
  officialCarrier: "anthropic-api-container-skills";
  payload: Record<string, unknown> & LooseRecord<AnthropicApiSkillActivationPayload>;
}

export interface DeepMindSkillActivationPlan extends SkillActivationPlanBase {
  provider: ProviderId;
  mode: "google-adk-local" | "google-adk-code-defined";
  officialCarrier: "google-adk-skill-toolset";
  payload: Record<string, unknown> & LooseRecord<DeepMindSkillToolsetPayload>;
}

export type SkillActivationPayload =
  | OpenAIShellToolPayload
  | AnthropicSdkSkillActivationPayload
  | AnthropicApiSkillActivationPayload
  | DeepMindSkillToolsetPayload;

export type SkillActivationPlan =
  | OpenAISkillActivationPlan
  | AnthropicSdkSkillActivationPlan
  | AnthropicApiSkillActivationPlan
  | DeepMindSkillActivationPlan;

export type SkillProviderBindingLike =
  | SkillProviderBinding
  | {
      provider: ProviderId;
      mode: SkillBindingMode;
      layer?: Exclude<SdkLayer, "auto">;
      details: SkillBindingDetailsInput;
    };

export type SkillActivationPlanLike =
  | SkillActivationPlan
  | {
      provider: ProviderId;
      mode: SkillBindingMode;
      layer?: Exclude<SdkLayer, "auto">;
      officialCarrier:
        | "openai-shell-environment"
        | "anthropic-sdk-filesystem-skill"
        | "anthropic-api-container-skills"
        | "google-adk-skill-toolset";
      payload: Record<string, unknown>;
      entry: SkillEntryDocument;
      resources?: SkillResourceFile[];
      helpers?: SkillHelperFile[];
    };

export interface SkillActivateInput {
  container: SkillContainer;
  provider: ProviderId;
  includeResources?: boolean;
  includeHelpers?: boolean;
}

interface SkillUseInputBase {
  mode?: SkillBindingMode;
  layer?: Exclude<SdkLayer, "auto">;
  details?: SkillBindingDetailsInput;
  includeResources?: boolean;
  includeHelpers?: boolean;
}

export interface SkillUseFromSourceInput extends SkillContainerCreateInput, SkillUseInputBase {}

export interface SkillUseFromContainerInput extends SkillUseInputBase {
  container: SkillContainer;
}

export interface SkillUseFromReferenceInput extends SkillUseInputBase {
  reference: SkillReferenceInput;
  policy?: Partial<SkillExecutionPolicy>;
  loading?: Partial<SkillLoadingPolicy>;
}

export type SkillUseInput =
  | SkillUseFromSourceInput
  | SkillUseFromContainerInput
  | SkillUseFromReferenceInput;

export interface SkillMountInput {
  container: SkillContainer;
  includeResources?: boolean;
  includeHelpers?: boolean;
}

export interface SkillUseResult {
  container: SkillContainer;
  activation: SkillActivationPlan;
  invocation: PreparedInvocation<Record<string, unknown>>;
}

export interface SkillMountResult {
  container: SkillContainer;
  activation: SkillActivationPlan;
  invocation: PreparedInvocation<Record<string, unknown>>;
}

export interface SkillUploadFile {
  path: string;
  relativePath: string;
  role: "entry" | "resource" | "helper";
}

export interface SkillUploadBundle {
  rootDir: string;
  files: SkillUploadFile[];
}

export interface SkillManagedListInput {
  order?: "asc" | "desc";
  source?: "custom" | "anthropic";
}

export interface SkillManagedGetInput {
  skillId: string;
}

export interface SkillManagedContentGetInput {
  skillId: string;
}

export interface SkillManagedPublishInput extends SkillContainerCreateInput {
  container?: SkillContainer;
  displayTitle?: string | null;
}

export interface SkillManagedRemoveInput {
  skillId: string;
}

export interface SkillVersionListInput {
  skillId: string;
  order?: "asc" | "desc";
}

export interface SkillVersionGetInput {
  skillId: string;
  version: string;
}

export interface SkillVersionContentGetInput {
  skillId: string;
  version: string;
}

export interface SkillVersionPublishInput extends SkillContainerCreateInput {
  container?: SkillContainer;
  skillId: string;
  setDefault?: boolean;
}

export interface SkillVersionRemoveInput {
  skillId: string;
  version: string;
}

export interface SkillSetDefaultVersionInput {
  skillId: string;
  version: string;
}
