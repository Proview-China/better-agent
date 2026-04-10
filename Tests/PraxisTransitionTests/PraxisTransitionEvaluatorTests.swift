import Testing
@testable import PraxisState
@testable import PraxisTransition

struct PraxisTransitionEvaluatorTests {
  @Test
  func runCreatedEntersHotPathAndEmitsModelInferenceAction() throws {
    let evaluator = PraxisTransitionEvaluator()
    let state = makeState(status: .created, phase: .decision)
    let event = PraxisKernelEvent(
      eventID: "evt-run-created",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:00:00.000Z",
      payload: .runCreated(goalID: "goal-1")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    #expect(decision.fromStatus == .created)
    #expect(decision.toStatus == .acting)
    #expect(decision.nextPhase == .execution)
    #expect(decision.nextAction?.kind == .modelInference)
    #expect(decision.nextAction?.intent?.kind == .modelInference)
  }

  @Test
  func stateDeltaAppliedChoosesCapabilityCallFromWorkingStateHints() throws {
    let evaluator = PraxisTransitionEvaluator()
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

    #expect(decision.toStatus == .acting)
    #expect(decision.nextAction?.kind == .capabilityCall)
    #expect(decision.nextAction?.intent?.kind == .capabilityCall)
    #expect(decision.nextAction?.intent?.capabilityKey == "search.web")
  }

  @Test
  func stateDeltaAppliedChoosesCmpActionFromWorkingStateHints() throws {
    let evaluator = PraxisTransitionEvaluator()
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

    #expect(decision.toStatus == .acting)
    #expect(decision.nextAction?.kind == .cmpAction)
    #expect(decision.nextAction?.intent?.kind == .cmpAction)
    #expect(decision.nextAction?.intent?.cmpAction == "request_historical_context")
    #expect(decision.nextAction?.intent?.cmpInput?["projectID"]?.stringValue == "cmp-project")
  }

  @Test
  func intentQueuedMovesRunIntoWaitingAndStoresPendingIntentID() throws {
    let evaluator = PraxisTransitionEvaluator()
    let state = makeState(status: .acting, phase: .execution)
    let event = PraxisKernelEvent(
      eventID: "evt-intent-queued",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:02:00.000Z",
      payload: .intentQueued(intentID: "intent-1", kind: "model_inference", priority: "normal")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    #expect(decision.toStatus == .waiting)
    #expect(decision.nextAction?.kind == .wait)
    #expect(decision.stateDelta?.control?.pendingIntentID == "intent-1")
  }

  @Test
  func capabilityResultReceivedReturnsRunToDecisionPhase() throws {
    let evaluator = PraxisTransitionEvaluator()
    let state = makeState(status: .waiting, phase: .execution)
    let event = PraxisKernelEvent(
      eventID: "evt-capability-result",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:03:00.000Z",
      payload: .capabilityResultReceived(requestID: "request-1", resultID: "result-1", status: "success")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    #expect(decision.toStatus == .deciding)
    #expect(decision.nextPhase == .decision)
    #expect(decision.stateDelta?.observed?.lastResultID == "result-1")
    #expect(decision.stateDelta?.observed?.lastResultStatus == "success")
  }

  @Test
  func runPausedFollowsRarePathAndEmitsPauseAction() throws {
    let evaluator = PraxisTransitionEvaluator()
    let state = makeState(status: .waiting, phase: .execution)
    let event = PraxisKernelEvent(
      eventID: "evt-run-paused",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:04:00.000Z",
      payload: .runPaused(reason: "manual intervention")
    )

    let decision = try evaluator.evaluate(currentState: state, incomingEvent: event)

    #expect(decision.toStatus == .paused)
    #expect(decision.nextAction?.kind == .pause)
  }

  @Test
  func illegalTransitionsAreRejectedWithInvalidTransitionError() {
    let evaluator = PraxisTransitionEvaluator()
    let state = makeState(status: .completed, phase: .commit)
    let event = PraxisKernelEvent(
      eventID: "evt-illegal",
      sessionID: "session-1",
      runID: "run-1",
      createdAt: "2026-03-17T12:05:00.000Z",
      payload: .intentQueued(intentID: "intent-2", kind: "capability_call", priority: "high")
    )

    do {
      _ = try evaluator.evaluate(currentState: state, incomingEvent: event)
      Issue.record("Expected PraxisInvalidTransitionError, but evaluation unexpectedly succeeded.")
    } catch let error as PraxisInvalidTransitionError {
      #expect(error.fromStatus == .completed)
      #expect(error.eventType == .intentQueued)
    } catch {
      Issue.record("Expected PraxisInvalidTransitionError, got \(error)")
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
