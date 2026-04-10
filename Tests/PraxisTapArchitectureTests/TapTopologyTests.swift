import Testing
@testable import PraxisTapAvailability
@testable import PraxisTapGovernance
@testable import PraxisTapProvision
@testable import PraxisTapReview
@testable import PraxisTapRuntime
@testable import PraxisTapTypes

// TODO(reboot-plan):
// - 增加 TAP 六分结构的依赖方向测试，确认 governance/review/provision/runtime/availability 不越界。
// - 增加治理、审查、供应、availability blueprint 守卫。
// - 后续可继续拆分：TapBoundaryTests.swift、TapDependencyTests.swift、TapBlueprintTests.swift。

struct TapTopologyTests {
  @Test
  func tapDomainSplitIntoSixSubmodules() {
    #expect(PraxisTapTypesModule.boundary.name == "PraxisTapTypes")
    #expect(PraxisTapGovernanceModule.boundary.name == "PraxisTapGovernance")
    #expect(PraxisTapReviewModule.boundary.name == "PraxisTapReview")
    #expect(PraxisTapProvisionModule.boundary.name == "PraxisTapProvision")
    #expect(PraxisTapRuntimeModule.boundary.name == "PraxisTapRuntime")
    #expect(PraxisTapAvailabilityModule.boundary.name == "PraxisTapAvailability")
  }
}
