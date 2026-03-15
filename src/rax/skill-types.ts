import type { ProviderId, SdkLayer } from "./types.js";

export type SkillSourceKind = "local";

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
  | "openai-hosted-shell"
  | "anthropic-sdk-filesystem"
  | "anthropic-api-managed"
  | "google-adk-local"
  | "google-adk-code-defined";

export interface SkillProviderBinding {
  provider: ProviderId;
  mode: SkillBindingMode;
  layer?: Exclude<SdkLayer, "auto">;
  details: Record<string, unknown>;
}

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
  details?: Record<string, unknown>;
}

export interface SkillActivationPlan {
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
}

export interface SkillActivateInput {
  container: SkillContainer;
  provider: ProviderId;
  includeResources?: boolean;
  includeHelpers?: boolean;
}
