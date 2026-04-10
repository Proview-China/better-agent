import type {
  CapabilityManifest,
} from "../capability-types/index.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import {
  createTapToolingBaselineCapabilityPackages,
  createTapToolingCapabilityPackage,
  isTapToolingBaselineCapabilityKey,
} from "../capability-package/index.js";
import { materializeCapabilityManifestFromActivation } from "../ta-pool-runtime/activation-materializer.js";
import {
  createTapToolingActivationFactory,
  createTapToolingCapabilityAdapter,
} from "./tap-tooling/adapters.js";
import type {
  BrowserPlaywrightInput,
  CodeDiffInput,
  CodeEditInput,
  CodePatchInput,
  CommandExecutionResult,
  DocWriteInput,
  GitCommitInput,
  GitDiffInput,
  GitPushInput,
  GitStatusInput,
  RegisterTapToolingBaselineResult,
  RepoWriteEntry,
  RepoWriteInput,
  ShellRestrictedInput,
  ShellSessionInput,
  SkillDocGenerateInput,
  SkillDocSection,
  SpreadsheetWriteInput,
  TapToolingAdapterOptions,
  TapToolingRegistrationTarget,
  WriteTodosInput,
} from "./tap-tooling/shared.js";

export type {
  BrowserPlaywrightInput,
  CodeDiffInput,
  CodeEditInput,
  CodePatchInput,
  CommandExecutionResult,
  DocWriteInput,
  GitCommitInput,
  GitDiffInput,
  GitPushInput,
  GitStatusInput,
  RegisterTapToolingBaselineResult,
  RepoWriteEntry,
  RepoWriteInput,
  ShellRestrictedInput,
  ShellSessionInput,
  SkillDocGenerateInput,
  SkillDocSection,
  SpreadsheetWriteInput,
  TapToolingAdapterOptions,
  TapToolingRegistrationTarget,
  WriteTodosInput,
} from "./tap-tooling/shared.js";
export {
  createTapToolingActivationFactory,
  createTapToolingCapabilityAdapter,
} from "./tap-tooling/adapters.js";

export function registerTapToolingBaseline(
  target: TapToolingRegistrationTarget,
  options: TapToolingAdapterOptions,
): RegisterTapToolingBaselineResult {
  const packages = createTapToolingBaselineCapabilityPackages();
  const manifests: CapabilityManifest[] = [];
  const bindings: unknown[] = [];
  const activationFactoryRefs = new Set<string>();
  const capabilityKeys: RegisterTapToolingBaselineResult["capabilityKeys"] = [];

  for (const capabilityPackage of packages) {
    const capabilityKey = capabilityPackage.manifest.capabilityKey;
    if (!isTapToolingBaselineCapabilityKey(capabilityKey)) {
      continue;
    }

    const activationSpec = capabilityPackage.activationSpec;
    if (!activationSpec) {
      throw new Error(`Capability package ${capabilityKey} is missing an activation spec.`);
    }

    const manifest = materializeCapabilityManifestFromActivation({
      capabilityPackage,
      activationSpec,
      capabilityIdPrefix: "capability",
    });
    manifests.push(manifest);
    capabilityKeys.push(capabilityKey);
    const adapter = createTapToolingCapabilityAdapter(capabilityKey, options);
    bindings.push(target.registerCapabilityAdapter(manifest, adapter));
    target.registerTaActivationFactory(
      activationSpec.adapterFactoryRef,
      createTapToolingActivationFactory(capabilityKey, options),
    );
    activationFactoryRefs.add(activationSpec.adapterFactoryRef);
  }

  return {
    capabilityKeys,
    manifests,
    packages,
    bindings,
    activationFactoryRefs: [...activationFactoryRefs],
  };
}

export function createTapToolingProvisioningPackage(
  capabilityKey: string,
): CapabilityPackage | undefined {
  if (!isTapToolingBaselineCapabilityKey(capabilityKey)) {
    return undefined;
  }

  return createTapToolingCapabilityPackage(capabilityKey);
}
