import Testing
@testable import PraxisCmpDbModel
@testable import PraxisCmpDelivery
@testable import PraxisCmpFiveAgent
@testable import PraxisCmpGitModel
@testable import PraxisCmpMqModel
@testable import PraxisCmpProjection
@testable import PraxisCmpSections
@testable import PraxisCmpTypes

// TODO(reboot-plan):
// - 增加 CMP 八分结构的单向依赖守卫，确认 model/planner 不回流宿主实现。
// - 增加 sections/projection/delivery/git/db/mq/five-agent 的 blueprint 测试。
// - 后续可继续拆分：CmpBoundaryTests.swift、CmpDependencyTests.swift、CmpBlueprintTests.swift。

struct CmpTopologyTests {
  @Test
  func cmpDomainSplitIntoEightSubmodules() {
    #expect(PraxisCmpTypesModule.boundary.name == "PraxisCmpTypes")
    #expect(PraxisCmpSectionsModule.boundary.name == "PraxisCmpSections")
    #expect(PraxisCmpProjectionModule.boundary.name == "PraxisCmpProjection")
    #expect(PraxisCmpDeliveryModule.boundary.name == "PraxisCmpDelivery")
    #expect(PraxisCmpGitModelModule.boundary.name == "PraxisCmpGitModel")
    #expect(PraxisCmpDbModelModule.boundary.name == "PraxisCmpDbModel")
    #expect(PraxisCmpMqModelModule.boundary.name == "PraxisCmpMqModel")
    #expect(PraxisCmpFiveAgentModule.boundary.name == "PraxisCmpFiveAgent")
  }
}
