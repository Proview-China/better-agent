import type { DispatchContextPackageInput } from "../../agent_core/cmp-types/index.js";
import type {
  RaxCmpManualControlInput,
  RaxCmpManualControlSurface,
} from "../cmp-types.js";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createDefaultControlSurface(projectId: string): RaxCmpManualControlSurface {
  return {
    executionStyle: "automatic",
    mode: "active_preferred",
    scope: {
      lineage: {
        projectIds: [projectId],
        agentIds: [],
        lineageRoots: [],
        branchFamilies: ["cmp"],
        targetAgentIds: [],
      },
      dispatch: "lineage_only",
    },
    truth: {
      readbackPriority: "git_first",
      fallbackPolicy: "git_rebuild",
      recoveryPreference: "reconcile",
    },
    automation: {
      autoIngest: true,
      autoCommit: true,
      autoResolve: true,
      autoMaterialize: true,
      autoDispatch: true,
      autoReturnToCoreAgent: true,
      autoSeedChildren: true,
    },
  };
}

function applyExecutionStyleDefaults(
  base: RaxCmpManualControlSurface,
  executionStyle: RaxCmpManualControlSurface["executionStyle"],
): RaxCmpManualControlSurface {
  if (executionStyle === "manual") {
    return {
      ...base,
      executionStyle,
      automation: {
        autoIngest: false,
        autoCommit: false,
        autoResolve: false,
        autoMaterialize: false,
        autoDispatch: false,
        autoReturnToCoreAgent: false,
        autoSeedChildren: false,
      },
    };
  }

  if (executionStyle === "guided") {
    return {
      ...base,
      executionStyle,
      automation: {
        ...base.automation,
        autoReturnToCoreAgent: false,
        autoSeedChildren: false,
      },
    };
  }

  return {
    ...base,
    executionStyle,
  };
}

export function resolveControlSurface(input: {
  projectId: string;
  base?: RaxCmpManualControlSurface;
  override?: RaxCmpManualControlInput;
}): RaxCmpManualControlSurface {
  const starting = structuredClone(input.base ?? createDefaultControlSurface(input.projectId));
  const executionStyle = input.override?.executionStyle ?? starting.executionStyle;
  const withStyleDefaults = applyExecutionStyleDefaults(starting, executionStyle);

  return {
    ...withStyleDefaults,
    mode: input.override?.mode ?? withStyleDefaults.mode,
    scope: {
      lineage: {
        projectIds: uniqueStrings(input.override?.scope?.lineage?.projectIds ?? withStyleDefaults.scope.lineage.projectIds),
        agentIds: uniqueStrings(input.override?.scope?.lineage?.agentIds ?? withStyleDefaults.scope.lineage.agentIds),
        lineageRoots: uniqueStrings(input.override?.scope?.lineage?.lineageRoots ?? withStyleDefaults.scope.lineage.lineageRoots),
        branchFamilies: input.override?.scope?.lineage?.branchFamilies
          ? [...new Set(input.override.scope.lineage.branchFamilies)]
          : [...withStyleDefaults.scope.lineage.branchFamilies],
        targetAgentIds: uniqueStrings(input.override?.scope?.lineage?.targetAgentIds ?? withStyleDefaults.scope.lineage.targetAgentIds),
      },
      dispatch: input.override?.scope?.dispatch ?? withStyleDefaults.scope.dispatch,
    },
    truth: {
      readbackPriority: input.override?.truth?.readbackPriority ?? withStyleDefaults.truth.readbackPriority,
      fallbackPolicy: input.override?.truth?.fallbackPolicy ?? withStyleDefaults.truth.fallbackPolicy,
      recoveryPreference: input.override?.truth?.recoveryPreference ?? withStyleDefaults.truth.recoveryPreference,
    },
    automation: {
      autoIngest: input.override?.automation?.autoIngest ?? withStyleDefaults.automation.autoIngest,
      autoCommit: input.override?.automation?.autoCommit ?? withStyleDefaults.automation.autoCommit,
      autoResolve: input.override?.automation?.autoResolve ?? withStyleDefaults.automation.autoResolve,
      autoMaterialize: input.override?.automation?.autoMaterialize ?? withStyleDefaults.automation.autoMaterialize,
      autoDispatch: input.override?.automation?.autoDispatch ?? withStyleDefaults.automation.autoDispatch,
      autoReturnToCoreAgent: input.override?.automation?.autoReturnToCoreAgent ?? withStyleDefaults.automation.autoReturnToCoreAgent,
      autoSeedChildren: input.override?.automation?.autoSeedChildren ?? withStyleDefaults.automation.autoSeedChildren,
    },
    metadata: {
      ...(withStyleDefaults.metadata ?? {}),
      ...(input.override?.metadata ?? {}),
    },
  };
}

function hasManualOverride(input: {
  control: RaxCmpManualControlSurface;
  payloadMetadata?: Record<string, unknown>;
}): boolean {
  return input.control.executionStyle === "manual"
    || input.control.metadata?.manualOverride === true
    || input.payloadMetadata?.manualOverride === true;
}

export function assertAutomationAllowed(input: {
  control: RaxCmpManualControlSurface;
  gate:
    | "autoIngest"
    | "autoCommit"
    | "autoResolve"
    | "autoMaterialize"
    | "autoDispatch"
    | "autoReturnToCoreAgent"
    | "autoSeedChildren";
  label: string;
  payloadMetadata?: Record<string, unknown>;
}): void {
  if (input.control.automation[input.gate]) {
    return;
  }
  if (hasManualOverride({
    control: input.control,
    payloadMetadata: input.payloadMetadata,
  })) {
    return;
  }
  throw new Error(`${input.label} is disabled by the CMP manual control surface.`);
}

export function assertDispatchAllowed(input: {
  control: RaxCmpManualControlSurface;
  targetKind: DispatchContextPackageInput["targetKind"];
  payloadMetadata?: Record<string, unknown>;
}): void {
  assertAutomationAllowed({
    control: input.control,
    gate: "autoDispatch",
    label: "CMP automatic dispatch",
    payloadMetadata: input.payloadMetadata,
  });

  const manualOverride = hasManualOverride({
    control: input.control,
    payloadMetadata: input.payloadMetadata,
  });
  if (input.control.scope.dispatch === "disabled" && !manualOverride) {
    throw new Error("CMP dispatch is disabled by the manual control surface.");
  }
  if (input.control.scope.dispatch === "core_agent_only" && input.targetKind !== "core_agent" && !manualOverride) {
    throw new Error("CMP dispatch scope is restricted to core_agent only.");
  }
  if (input.control.scope.dispatch === "manual_targets" && !manualOverride) {
    throw new Error("CMP dispatch requires a manual override for manual_targets scope.");
  }

  if (input.targetKind === "core_agent") {
    assertAutomationAllowed({
      control: input.control,
      gate: "autoReturnToCoreAgent",
      label: "CMP auto-return to core agent",
      payloadMetadata: input.payloadMetadata,
    });
  }
  if (input.targetKind === "child") {
    assertAutomationAllowed({
      control: input.control,
      gate: "autoSeedChildren",
      label: "CMP auto-seed to child agents",
      payloadMetadata: input.payloadMetadata,
    });
  }
}
