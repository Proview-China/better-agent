import Testing
@testable import PraxisCheckpoint
@testable import PraxisCoreTypes
@testable import PraxisGoal
@testable import PraxisJournal
@testable import PraxisRun
@testable import PraxisSession
@testable import PraxisState
@testable import PraxisTransition

// TODO(reboot-plan):
// - 增加 Foundation 依赖方向守卫，确认低层不反向依赖 Capability/TAP/CMP/Host。
// - 增加 blueprint 内容测试，覆盖 sourceKinds、responsibilities、恢复边界等稳定字段。
// - 后续可继续拆分：FoundationBoundaryTests.swift、FoundationDependencyTests.swift、FoundationBlueprintTests.swift。

struct FoundationTopologyTests {
  @Test
  func foundationModuleNamesStayStable() {
    #expect(PraxisCoreTypesModule.boundary.name == "PraxisCoreTypes")
    #expect(PraxisGoalModule.boundary.name == "PraxisGoal")
    #expect(PraxisStateModule.boundary.name == "PraxisState")
    #expect(PraxisTransitionModule.boundary.name == "PraxisTransition")
    #expect(PraxisRunModule.boundary.name == "PraxisRun")
    #expect(PraxisSessionModule.boundary.name == "PraxisSession")
    #expect(PraxisJournalModule.boundary.name == "PraxisJournal")
    #expect(PraxisCheckpointModule.boundary.name == "PraxisCheckpoint")
  }
}
