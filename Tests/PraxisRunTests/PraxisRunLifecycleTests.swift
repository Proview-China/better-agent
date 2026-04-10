import Testing
@testable import PraxisRun
@testable import PraxisState
@testable import PraxisTransition

struct PraxisRunLifecycleTests {
  @Test
  func advanceRunAppliesTransitionDecisionAndStateDelta() throws {
    let lifecycle = PraxisRunLifecycleService()
    let run = lifecycle.createRun(id: .init(rawValue: "run-1"))
    let event = lifecycle.makeCreatedEvent(
      runID: "run-1",
      sessionID: "session-1",
      goalID: "goal-1",
      eventID: "evt-1",
      createdAt: "2026-04-10T11:00:00.000Z"
    )

    let result = try lifecycle.advance(run, with: event)

    #expect(result.tick.sequence == 1)
    #expect(result.run.phase == .running)
    #expect(result.run.lastEventID == "evt-1")
    #expect(result.state.control.status == .acting)
    #expect(result.state.control.phase == .execution)
    #expect(result.decision.nextAction?.kind == .modelInference)
  }

  @Test
  func advanceRunCapturesFailureSummaryFromState() throws {
    let lifecycle = PraxisRunLifecycleService()
    let initial = PraxisStateSnapshot(
      control: .init(status: .acting, phase: .execution, retryCount: 0),
      working: [:],
      observed: .init(artifactRefs: []),
      recovery: .init()
    )
    let run = lifecycle.createRun(id: .init(rawValue: "run-2"), initialState: initial)
    let event = lifecycle.makeFailedEvent(
      runID: "run-2",
      sessionID: "session-1",
      code: "tool_failure",
      message: "Capability execution failed.",
      eventID: "evt-fail",
      createdAt: "2026-04-10T11:01:00.000Z"
    )

    let result = try lifecycle.advance(run, with: event)

    #expect(result.run.phase == .failed)
    #expect(result.run.failure == .init(summary: "Capability execution failed.", code: "tool_failure"))
    #expect(result.state.recovery.lastErrorCode == "tool_failure")
  }
}
