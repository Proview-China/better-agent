import Testing
import PraxisMpTypes

struct PraxisMpTypesTests {
  @Test
  func mpScopeDefaultsMatchScopeLevel() throws {
    let isolated = PraxisMpScopeDescriptor(projectID: "project.local", agentID: "agent.local")
    let bridged = PraxisMpScopeDescriptor(
      projectID: "project.local",
      agentID: "agent.local",
      sessionID: "session.local",
      sessionMode: .bridged
    )
    let global = PraxisMpScopeDescriptor(
      projectID: "project.local",
      agentID: "dispatcher.local",
      scopeLevel: .global
    )

    #expect(isolated.scopeLevel == .agentIsolated)
    #expect(isolated.sessionMode == .isolated)
    #expect(isolated.visibilityState == .localOnly)
    #expect(isolated.promotionState == .localOnly)
    #expect(bridged.visibilityState == .sessionBridged)
    #expect(global.sessionMode == .shared)
    #expect(global.visibilityState == .globalShared)
    #expect(global.promotionState == .promotedToGlobal)
  }

  @Test
  func mpPromotionTransitionGuardRejectsBackwardsMoves() throws {
    #expect(
      PraxisMpScopeDescriptor.canTransitionPromotionState(
        from: .localOnly,
        to: .submittedToParent
      )
    )
    #expect(
      PraxisMpScopeDescriptor.canTransitionPromotionState(
        from: .promotedToGlobal,
        to: .localOnly
      ) == false
    )
  }
}
