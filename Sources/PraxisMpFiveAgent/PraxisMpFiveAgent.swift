import PraxisCoreTypes

// TODO(reboot-plan):
// - Keep MP five-agent focused on role protocol, pure in-memory workflow orchestration, and summary surfaces.
// - Do not let this target depend on host adapters, persistence brands, or runtime composition.

public enum PraxisMpFiveAgentModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisMpFiveAgent",
    responsibility: "MP five-agent role protocol, runtime state, and pure workflow orchestration for ingest/align/resolve/history.",
    tsModules: [
      "src/agent_core/mp-five-agent/shared.ts",
      "src/agent_core/mp-five-agent/types.ts",
      "src/agent_core/mp-five-agent/configuration.ts",
      "src/agent_core/mp-five-agent/runtime.test.ts",
    ],
  )
}
