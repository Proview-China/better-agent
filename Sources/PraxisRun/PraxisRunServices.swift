import PraxisCoreTypes
import PraxisState
import PraxisTransition

/// Pure lifecycle helpers for creating and advancing run aggregates.
public struct PraxisRunLifecycleService: Sendable {
  public let evaluator: PraxisTransitionEvaluator

  /// Creates the run lifecycle service.
  ///
  /// - Parameter evaluator: Transition evaluator used to compute the next decision.
  public init(evaluator: PraxisTransitionEvaluator = .init()) {
    self.evaluator = evaluator
  }

  /// Creates a run aggregate from an initial projected state.
  ///
  /// - Parameters:
  ///   - id: Stable run identifier.
  ///   - initialState: Initial projected state. Defaults to ``createInitialAgentState()``.
  /// - Returns: A newly initialized run aggregate.
  public func createRun(
    id: PraxisRunID,
    initialState: PraxisStateSnapshot = createInitialAgentState()
  ) -> PraxisRunAggregate {
    PraxisRunAggregate(
      id: id,
      phase: phase(for: initialState.control.status),
      latestState: initialState
    )
  }

  /// Advances a run by one incoming event.
  ///
  /// The event is first evaluated by the transition layer, then projected into state,
  /// and finally merged with any state delta emitted by the transition decision.
  ///
  /// - Parameters:
  ///   - run: Current run aggregate before the event is applied.
  ///   - event: Incoming kernel event to consume.
  /// - Returns: The updated run aggregate, state snapshot, and tick metadata.
  /// - Throws: Any transition or state-projection error raised while processing the event.
  public func advance(
    _ run: PraxisRunAggregate,
    with event: PraxisKernelEvent
  ) throws -> PraxisRunAdvanceResult {
    let decision = try evaluator.evaluate(
      currentState: run.latestState,
      incomingEvent: event
    )
    let eventState = try applyEventToState(run.latestState, event: event)
    let finalState = try applyDecisionDelta(decision.stateDelta, to: eventState)
    let nextRun = PraxisRunAggregate(
      id: run.id,
      phase: phase(for: finalState.control.status),
      tickCount: run.tickCount + 1,
      lastEventID: event.eventID,
      pendingIntentID: finalState.control.pendingIntentID,
      lastCheckpointReference: finalState.recovery.lastCheckpointRef,
      failure: failure(from: finalState),
      latestState: finalState
    )
    let tick = PraxisRunTick(
      sequence: nextRun.tickCount,
      decision: decision.nextAction,
      eventID: event.eventID
    )
    return PraxisRunAdvanceResult(
      run: nextRun,
      state: finalState,
      decision: decision,
      tick: tick,
      incomingEvent: event
    )
  }

  /// Creates a `run.created` event for a run.
  ///
  /// - Parameters:
  ///   - runID: Run identifier string.
  ///   - sessionID: Session identifier string.
  ///   - goalID: Goal identifier string.
  ///   - eventID: Event identifier string.
  ///   - createdAt: Event creation timestamp string.
  /// - Returns: A kernel event representing run creation.
  public func makeCreatedEvent(
    runID: String,
    sessionID: String,
    goalID: String,
    eventID: String,
    createdAt: String
  ) -> PraxisKernelEvent {
    PraxisKernelEvent(
      eventID: eventID,
      sessionID: sessionID,
      runID: runID,
      createdAt: createdAt,
      payload: .runCreated(goalID: goalID)
    )
  }

  /// Creates a `run.resumed` event for a run.
  ///
  /// - Parameters:
  ///   - runID: Run identifier string.
  ///   - sessionID: Session identifier string.
  ///   - checkpointID: Optional checkpoint identifier to resume from.
  ///   - eventID: Event identifier string.
  ///   - createdAt: Event creation timestamp string.
  /// - Returns: A kernel event representing run resumption.
  public func makeResumedEvent(
    runID: String,
    sessionID: String,
    checkpointID: String?,
    eventID: String,
    createdAt: String
  ) -> PraxisKernelEvent {
    PraxisKernelEvent(
      eventID: eventID,
      sessionID: sessionID,
      runID: runID,
      createdAt: createdAt,
      payload: .runResumed(checkpointID: checkpointID)
    )
  }

  /// Creates a `run.paused` event for a run.
  ///
  /// - Parameters:
  ///   - runID: Run identifier string.
  ///   - sessionID: Session identifier string.
  ///   - reason: Human-readable pause reason.
  ///   - eventID: Event identifier string.
  ///   - createdAt: Event creation timestamp string.
  /// - Returns: A kernel event representing a paused run.
  public func makePausedEvent(
    runID: String,
    sessionID: String,
    reason: String,
    eventID: String,
    createdAt: String
  ) -> PraxisKernelEvent {
    PraxisKernelEvent(
      eventID: eventID,
      sessionID: sessionID,
      runID: runID,
      createdAt: createdAt,
      payload: .runPaused(reason: reason)
    )
  }

  /// Creates a `run.completed` event for a run.
  ///
  /// - Parameters:
  ///   - runID: Run identifier string.
  ///   - sessionID: Session identifier string.
  ///   - resultID: Optional terminal result identifier.
  ///   - eventID: Event identifier string.
  ///   - createdAt: Event creation timestamp string.
  /// - Returns: A kernel event representing run completion.
  public func makeCompletedEvent(
    runID: String,
    sessionID: String,
    resultID: String?,
    eventID: String,
    createdAt: String
  ) -> PraxisKernelEvent {
    PraxisKernelEvent(
      eventID: eventID,
      sessionID: sessionID,
      runID: runID,
      createdAt: createdAt,
      payload: .runCompleted(resultID: resultID)
    )
  }

  /// Creates a `run.failed` event for a run.
  ///
  /// - Parameters:
  ///   - runID: Run identifier string.
  ///   - sessionID: Session identifier string.
  ///   - code: Structured failure code.
  ///   - message: Human-readable failure message.
  ///   - eventID: Event identifier string.
  ///   - createdAt: Event creation timestamp string.
  /// - Returns: A kernel event representing run failure.
  public func makeFailedEvent(
    runID: String,
    sessionID: String,
    code: String,
    message: String,
    eventID: String,
    createdAt: String
  ) -> PraxisKernelEvent {
    PraxisKernelEvent(
      eventID: eventID,
      sessionID: sessionID,
      runID: runID,
      createdAt: createdAt,
      payload: .runFailed(code: code, message: message)
    )
  }
}

/// Minimal in-memory coordinator that owns the currently active run aggregate.
public actor PraxisRunCoordinator {
  public private(set) var activeRun: PraxisRunAggregate?
  public let lifecycle: PraxisRunLifecycleService

  /// Creates a run coordinator.
  ///
  /// - Parameters:
  ///   - activeRun: Optional active run to seed the coordinator with.
  ///   - lifecycle: Lifecycle helper used to advance the run.
  public init(
    activeRun: PraxisRunAggregate? = nil,
    lifecycle: PraxisRunLifecycleService = .init()
  ) {
    self.activeRun = activeRun
    self.lifecycle = lifecycle
  }

  /// Begins a new run and makes it active.
  ///
  /// - Parameters:
  ///   - runID: Stable run identifier.
  ///   - initialState: Initial projected state. Defaults to ``createInitialAgentState()``.
  /// - Returns: The newly created active run aggregate.
  public func begin(
    runID: PraxisRunID,
    initialState: PraxisStateSnapshot = createInitialAgentState()
  ) -> PraxisRunAggregate {
    let run = lifecycle.createRun(id: runID, initialState: initialState)
    activeRun = run
    return run
  }

  /// Loads an existing run aggregate as the active run.
  ///
  /// - Parameter run: The run aggregate to make active.
  public func load(_ run: PraxisRunAggregate) {
    activeRun = run
  }

  /// Advances the current active run with a new event.
  ///
  /// - Parameter event: Incoming kernel event to consume.
  /// - Returns: The updated run advancement result.
  /// - Throws: `PraxisError.invalidInput` when no active run is loaded, or any
  ///   run lifecycle error raised while processing the event.
  public func advance(with event: PraxisKernelEvent) throws -> PraxisRunAdvanceResult {
    guard let activeRun else {
      throw PraxisError.invalidInput("No active run loaded in PraxisRunCoordinator.")
    }
    let result = try lifecycle.advance(activeRun, with: event)
    self.activeRun = result.run
    return result
  }

  /// Clears the active run.
  public func clear() {
    activeRun = nil
  }
}

private extension PraxisRunLifecycleService {
  func applyDecisionDelta(
    _ delta: PraxisStateDelta?,
    to state: PraxisStateSnapshot
  ) throws -> PraxisStateSnapshot {
    guard let delta else {
      return state
    }
    return try applyStateDelta(state, delta)
  }

  func phase(for status: PraxisAgentStatus) -> PraxisRunPhase {
    switch status {
    case .created:
      return .created
    case .idle, .deciding:
      return .queued
    case .acting, .waiting:
      return .running
    case .paused:
      return .paused
    case .completed:
      return .completed
    case .failed:
      return .failed
    case .cancelled:
      return .cancelled
    }
  }

  func failure(from state: PraxisStateSnapshot) -> PraxisRunFailure? {
    guard state.control.status == .failed else {
      return nil
    }
    let summary = state.recovery.lastErrorMessage ?? "Run failed."
    return PraxisRunFailure(
      summary: summary,
      code: state.recovery.lastErrorCode
    )
  }
}
