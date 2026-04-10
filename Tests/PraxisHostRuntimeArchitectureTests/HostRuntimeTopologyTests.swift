import Testing
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeFacades
@testable import PraxisRuntimePresentationBridge
@testable import PraxisRuntimeUseCases

// TODO(reboot-plan):
// - 增加 composition/use cases/facades/presentation bridge 的职责守卫测试。
// - 增加 Entry 只能经由 PresentationBridge 进入系统的显式测试。
// - 后续可继续拆分：HostRuntimeBoundaryTests.swift、HostRuntimeDependencyTests.swift、PresentationBridgeRuleTests.swift。

struct HostRuntimeTopologyTests {
  @Test
  func runtimeSplitIntoFourLayers() {
    #expect(PraxisRuntimeCompositionModule.boundary.name == "PraxisRuntimeComposition")
    #expect(PraxisRuntimeUseCasesModule.boundary.name == "PraxisRuntimeUseCases")
    #expect(PraxisRuntimeFacadesModule.boundary.name == "PraxisRuntimeFacades")
    #expect(PraxisRuntimePresentationBridgeModule.boundary.name == "PraxisRuntimePresentationBridge")
  }

  @Test
  func presentationBridgeBlueprintMatchesSplit() {
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.hostContractModules.count == 5)
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.runtimeModules.count == 4)
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.rules.contains("Entry 只能经由 RuntimePresentationBridge 进入系统。"))
  }
}
