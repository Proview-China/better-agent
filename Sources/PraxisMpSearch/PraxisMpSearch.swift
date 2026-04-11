import PraxisCoreTypes

// TODO(reboot-plan):
// - Keep MP search pure: planning, filtering, access gating, and reranking only.
// - Do not let this target depend on semantic stores, embeddings, or provider adapters directly.

public enum PraxisMpSearchModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisMpSearch",
    responsibility: "MP search planning, filtering, and reranking rules.",
    tsModules: [
      "src/agent_core/mp-runtime/search-planner.ts",
      "src/agent_core/mp-runtime/scope-enforcement.ts",
      "src/agent_core/mp-runtime/session-bridge.ts",
      "src/agent_core/mp-runtime/runtime-types.ts",
    ],
  )
}
