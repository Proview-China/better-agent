import XCTest
@testable import PraxisState
@testable import PraxisTransition

final class PraxisTransitionEvaluatorTests: XCTestCase {
  private let evaluator = PraxisTransitionEvaluator()

  func testRunCreatedEntersHotPathAndEmitsModelInferenceAction() throws {
    let state = makeState(status: .created, phase: .decision)
    let event = PraxisKernelEvent(
      eventID: "evt-run-created",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:00:00.000Z",
      payload: .runCreated(goalID: "goal-1")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    XCTAssertEqual(decision.fromStatus, .created)
    XCTAssertEqual(decision.toStatus, .acting)
    XCTAssertEqual(decision.nextPhase, .execution)
    XCTAssertEqual(decision.nextAction?.kind, .modelInference)
    XCTAssertEqual(decision.nextAction?.intent?.kind, .modelInference)
  }

  func testStateDeltaAppliedChoosesCapabilityCallFromWorkingStateHints() throws {
    let state = PraxisStateSnapshot(
      control: .init(status: .deciding, phase: .decision, retryCount: 0),
      working: [
        "nextCapabilityKey": "search.web",
        "nextCapabilityInput": [
          "query": "Praxis runtime kernel",
        ],
      ],
      observed: .init(artifactRefs: []),
      recovery: .init()
    )
    let event = PraxisKernelEvent(
      eventID: "evt-state-delta",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:01:00.000Z",
      payload: .stateDeltaApplied(
        delta: .init(working: state.working),
        previousStatus: .deciding,
        nextStatus: .acting
      )
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    XCTAssertEqual(decision.toStatus, .acting)
    XCTAssertEqual(decision.nextAction?.kind, .capabilityCall)
    XCTAssertEqual(decision.nextAction?.intent?.kind, .capabilityCall)
    XCTAssertEqual(decision.nextAction?.intent?.capabilityKey, "search.web")
  }

  func testStateDeltaAppliedChoosesCmpActionFromWorkingStateHints() throws {
    let state = PraxisStateSnapshot(
      control: .init(status: .deciding, phase: .decision, retryCount: 0),
      working: [
        "nextCmpAction": "request_historical_context",
        "nextCmpInput": [
          "requesterAgentID": "main",
          "projectID": "cmp-project",
          "reason": "Need the latest high-signal checked history.",
        ],
      ],
      observed: .init(artifactRefs: []),
      recovery: .init()
    )
    let event = PraxisKernelEvent(
      eventID: "evt-cmp-state-delta",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:01:30.000Z",
      payload: .stateDeltaApplied(
        delta: .init(working: state.working),
        previousStatus: .deciding,
        nextStatus: .acting
      )
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    XCTAssertEqual(decision.toStatus, .acting)
    XCTAssertEqual(decision.nextAction?.kind, .cmpAction)
    XCTAssertEqual(decision.nextAction?.intent?.kind, .cmpAction)
    XCTAssertEqual(decision.nextAction?.intent?.cmpAction, "request_historical_context")
    XCTAssertEqual(decision.nextAction?.intent?.cmpInput?["projectID"]?.stringValue, "cmp-project")
  }

  func testIntentQueuedMovesRunIntoWaitingAndStoresPendingIntentID() throws {
    let state = makeState(status: .acting, phase: .execution)
    let event = PraxisKernelEvent(
      eventID: "evt-intent-queued",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:02:00.000Z",
      payload: .intentQueued(intentID: "intent-1", kind: "model_inference", priority: "normal")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    XCTAssertEqual(decision.toStatus, .waiting)
    XCTAssertEqual(decision.nextAction?.kind, .wait)
    XCTAssertEqual(decision.stateDelta?.control?.pendingIntentID, "intent-1")
  }

  func testCapabilityResultReceivedReturnsRunToDecisionPhase() throws {
    let state = makeState(status: .waiting, phase: .execution)
    let event = PraxisKernelEvent(
      eventID: "evt-capability-result",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:03:00.000Z",
      payload: .capabilityResultReceived(requestID: "request-1", resultID: "result-1", status: "success")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    XCTAssertEqual(decision.toStatus, .deciding)
    XCTAssertEqual(decision.nextPhase, .decision)
    XCTAssertEqual(decision.stateDelta?.observed?.lastResultID, "result-1")
    XCTAssertEqual(decision.stateDelta?.observed?.lastResultStatus, "success")
  }

  func testRunPausedFollowsRarePathAndEmitsPauseAction() throws {
    let state = makeState(status: .waiting, phase: .execution)
    let event = PraxisKernelEvent(
      eventID: "evt-run-paused",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:04:00.000Z",
      payload: .runPaused(reason: "manual intervention")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    XCTAssertEqual(decision.toStatus, .paused)
    XCTAssertEqual(decision.nextAction?.kind, .pause)
  }

  func testIllegalTransitionsAreRejectedWithInvalidTransitionError() {
    let state = makeState(status: .completed, phase: .commit)
    let event = PraxisKernelEvent(
      eventID: "evt-illegal",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:05:00.000Z",
      payload: .intentQueued(intentID: "intent-2", kind: "capability_call", priority: "high")
    )

    XCTAssertThrowsError(
      try evaluator.evaluate(currentState: state, incomingEvent: event)
    ) { error in
      guard let error = error as? PraxisInvalidTransitionError else {
        return XCTFail("Expected PraxisInvalidTransitionError, got \(error)")
      }
      XCTAssertEqual(error.fromStatus, .completed)
      XCTAssertEqual(error.eventType, .intentQueued)
    }
  }

  private func makeState(status: PraxisAgentStatus, phase: PraxisAgentPhase) -> PraxisStateSnapshot {
    PraxisStateSnapshot(
      control: .init(status: status, phase: phase, retryCount: 0),
      working: [:],
      observed: .init(artifactRefs: []),
      recovery: .init()
    )
  }
}
