import Testing
@testable import PraxisCapabilityCatalog
@testable import PraxisCapabilityContracts
@testable import PraxisCapabilityPlanning
@testable import PraxisCapabilityResults

// TODO(reboot-plan):
// - 增加 Capability 子域单向依赖测试，防止反向依赖 TAP/CMP/Host。
// - 增加 contracts/planning/results/catalog 四分职责的 blueprint 守卫。
// - 后续可继续拆分：CapabilityBoundaryTests.swift、CapabilityDependencyTests.swift、CapabilityBlueprintTests.swift。

struct CapabilityTopologyTests {
  @Test
  func capabilityDomainSplitIntoFourSubmodules() {
    #expect(PraxisCapabilityContractsModule.boundary.name == "PraxisCapabilityContracts")
    #expect(PraxisCapabilityPlanningModule.boundary.name == "PraxisCapabilityPlanning")
    #expect(PraxisCapabilityResultsModule.boundary.name == "PraxisCapabilityResults")
    #expect(PraxisCapabilityCatalogModule.boundary.name == "PraxisCapabilityCatalog")
  }
}
