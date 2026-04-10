import Testing
@testable import PraxisInfraContracts
@testable import PraxisProviderContracts
@testable import PraxisToolingContracts
@testable import PraxisUserIOContracts
@testable import PraxisWorkspaceContracts

// TODO(reboot-plan):
// - 增加五类 HostContracts 之间互不耦合的守卫测试。
// - 增加协议族最小表面面积测试，防止业务模型偷偷回流到 contracts。
// - 后续可继续拆分：HostContractsBoundaryTests.swift、HostContractsDependencyTests.swift、HostContractsProtocolSurfaceTests.swift。

struct HostContractsTopologyTests {
  @Test
  func hostContractsSplitIntoProtocolFamilies() {
    #expect(PraxisProviderContractsModule.boundary.name == "PraxisProviderContracts")
    #expect(PraxisWorkspaceContractsModule.boundary.name == "PraxisWorkspaceContracts")
    #expect(PraxisToolingContractsModule.boundary.name == "PraxisToolingContracts")
    #expect(PraxisInfraContractsModule.boundary.name == "PraxisInfraContracts")
    #expect(PraxisUserIOContractsModule.boundary.name == "PraxisUserIOContracts")
  }
}
