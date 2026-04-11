import PraxisCoreTypes

// TODO(reboot-plan):
// - Keep MP shared types limited to memory, scope, freshness, promotion, and lineage semantics.
// - Do not pull persistence adapters or host runtime orchestration into this target.
// - Keep the Swift MP object model aligned with the TS memory workflow vocabulary without mirroring its directory structure.

public enum PraxisMpTypesModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisMpTypes",
    responsibility: "MP shared memory/scope object model and governance vocabulary.",
    tsModules: [
      "src/agent_core/mp-types/mp-memory.ts",
      "src/agent_core/mp-types/mp-scope.ts",
      "src/agent_core/mp-types/mp-actions.ts",
    ],
  )
}
