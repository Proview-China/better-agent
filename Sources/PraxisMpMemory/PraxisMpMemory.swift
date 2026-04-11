import PraxisCoreTypes

// TODO(reboot-plan):
// - Keep MP memory focused on pure workflow truth: alignment, supersede, bundling, and quality summaries.
// - Do not pull persistence adapters or host-runtime orchestration into this target.

public enum PraxisMpMemoryModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisMpMemory",
    responsibility: "MP memory workflow truth such as alignment, supersede, bundle assembly, and quality summaries.",
    tsModules: [
      "src/agent_core/mp-types/mp-memory.ts",
      "src/agent_core/mp-lancedb/lancedb-query.ts",
      "src/agent_core/runtime.mp-workflow.test.ts",
    ],
  )
}
