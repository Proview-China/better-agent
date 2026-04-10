import PraxisCoreTypes
import PraxisRuntimeUseCases
import PraxisRun

// TODO(reboot-plan):
// - 实现稳定 facade、宿主可消费 DTO、会话/运行视图聚合模型。
// - 让 facade 成为 runtime 对外表面，避免 CLI/UI/FFI 直接理解内部 use case 细节。
// - 补充 blueprint 之外的展示状态和面向宿主的只读快照类型。
// - 文件可继续拆分：RuntimeBlueprint.swift、FacadeDTOs.swift、RunFacade.swift、InspectionFacade.swift。

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
      "src/rax/mp-facade.ts",
      "src/agent_core/cmp-service",
    ],
  )
}
