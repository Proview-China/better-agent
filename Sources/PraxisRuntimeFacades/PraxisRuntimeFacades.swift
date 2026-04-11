import PraxisCoreTypes
import PraxisRuntimeUseCases
import PraxisRun

// TODO(reboot-plan):
// - Continue tightening stable facades, host-facing DTOs, and aggregated session/run view models.
// - Make facades the external runtime surface so CLI, UI, and FFI do not need to understand internal use-case details directly.
// - Keep CMP facades split by neutral host surface instead of regrowing one large aggregate facade.
// - Keep MP on its own host-neutral facade instead of leaving it inside the generic inspection bucket.
// - Add presentation state and host-facing read-only snapshot types beyond the blueprint metadata.
// - This file can later be split into RuntimeBlueprint.swift, FacadeDTOs.swift, RunFacade.swift, and InspectionFacade.swift.

public struct PraxisRuntimeBlueprint: Sendable, Equatable {
  public let foundationModules: [PraxisBoundaryDescriptor]
  public let functionalDomainModules: [PraxisBoundaryDescriptor]
  public let hostContractModules: [PraxisBoundaryDescriptor]
  public let runtimeModules: [PraxisBoundaryDescriptor]
  public let entrypoints: [String]
  public let rules: [String]

  public init(
    foundationModules: [PraxisBoundaryDescriptor],
    functionalDomainModules: [PraxisBoundaryDescriptor],
    hostContractModules: [PraxisBoundaryDescriptor],
    runtimeModules: [PraxisBoundaryDescriptor],
    entrypoints: [String],
    rules: [String],
  ) {
    self.foundationModules = foundationModules
    self.functionalDomainModules = functionalDomainModules
    self.hostContractModules = hostContractModules
    self.runtimeModules = runtimeModules
    self.entrypoints = entrypoints
    self.rules = rules
  }
}

public enum PraxisRuntimeFacadesModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisRuntimeFacades",
    responsibility: "对 CLI / UI / FFI 暴露的 facade 与稳定入口模型。",
    tsModules: [
      "src/rax/facade.ts",
      "src/rax/cmp/session.ts",
      "src/rax/cmp/project.ts",
      "src/rax/cmp/flow.ts",
      "src/rax/cmp/roles.ts",
      "src/rax/cmp/control.ts",
      "src/rax/mp-facade.ts",
      "src/agent_core/cmp-service",
    ],
  )
}
