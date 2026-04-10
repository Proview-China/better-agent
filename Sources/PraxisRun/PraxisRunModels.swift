import PraxisCoreTypes
import PraxisState
import PraxisTransition

/// Stable identifier for a run.
public struct PraxisRunID: PraxisIdentifier {
  public let rawValue: String

  /// Creates a stable run identifier.
  ///
  /// - Parameter rawValue: The persisted string form of the identifier.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }
}

/// High-level run phase derived from state transitions.
public enum PraxisRunPhase: String, Sendable, Codable {
  case created
  case queued
  case running
  case paused
  case completed
  case failed
  case cancelled
}

/// Aggregate representing the current truth of a run inside Foundation.
public struct PraxisRunAggregate: Sendable, Equatable, Codable {
  public let id: PraxisRunID
  public let phase: PraxisRunPhase
  public let tickCount: Int
  public let lastEventID: String?
  public let pendingIntentID: String?
  public let lastCheckpointReference: String?
  public let failure: PraxisRunFailure?
  public let latestState: PraxisStateSnapshot

  /// Creates a run aggregate.
  ///
  /// - Parameters:
  ///   - id: Stable run identifier.
  ///   - phase: High-level run phase.
  ///   - tickCount: Number of processed ticks.
  ///   - lastEventID: Optional latest processed event identifier.
  ///   - pendingIntentID: Optional pending intent identifier.
  ///   - lastCheckpointReference: Optional latest checkpoint reference.
  ///   - failure: Optional terminal failure summary.
  ///   - latestState: Latest projected state snapshot.
  public init(
    id: PraxisRunID,
    phase: PraxisRunPhase,
    tickCount: Int = 0,
    lastEventID: String? = nil,
    pendingIntentID: String? = nil,
    lastCheckpointReference: String? = nil,
    failure: PraxisRunFailure? = nil,
    latestState: PraxisStateSnapshot
  ) {
    self.id = id
    self.phase = phase
    self.tickCount = tickCount
    self.lastEventID = lastEventID
    self.pendingIntentID = pendingIntentID
    self.lastCheckpointReference = lastCheckpointReference
    self.failure = failure
    self.latestState = latestState
  }
}

/// Tick metadata emitted after processing one run event.
public struct PraxisRunTick: Sendable, Equatable, Codable {
  public let sequence: Int
  public let decision: PraxisNextActionDecision?
  public let eventID: String?

  /// Creates a run tick.
  ///
  /// - Parameters:
  ///   - sequence: Monotonic tick number for the run.
  ///   - decision: Optional next-action decision emitted by the transition evaluator.
  ///   - eventID: Optional source event identifier.
  public init(
    sequence: Int,
    decision: PraxisNextActionDecision? = nil,
    eventID: String? = nil
  ) {
    self.sequence = sequence
    self.decision = decision
    self.eventID = eventID
  }
}

/// Result of advancing a run by one event.
public struct PraxisRunAdvanceResult: Sendable, Equatable {
  public let run: PraxisRunAggregate
  public let state: PraxisStateSnapshot
  public let decision: PraxisTransitionDecision
  public let tick: PraxisRunTick
  public let incomingEvent: PraxisKernelEvent

  /// Creates a run advance result.
  ///
  /// - Parameters:
  ///   - run: Updated run aggregate after the event is processed.
  ///   - state: Updated projected state snapshot.
  ///   - decision: Transition decision produced for the event.
  ///   - tick: Tick metadata emitted for this advancement.
  ///   - incomingEvent: Event that drove the advancement.
  public init(
    run: PraxisRunAggregate,
    state: PraxisStateSnapshot,
    decision: PraxisTransitionDecision,
    tick: PraxisRunTick,
    incomingEvent: PraxisKernelEvent
  ) {
    self.run = run
    self.state = state
    self.decision = decision
    self.tick = tick
    self.incomingEvent = incomingEvent
  }
}

/// Terminal failure summary attached to a run aggregate.
public struct PraxisRunFailure: Sendable, Equatable, Codable {
  public let summary: String
  public let code: String?

  /// Creates a run failure summary.
  ///
  /// - Parameters:
  ///   - summary: Human-readable failure summary.
  ///   - code: Optional structured failure code.
  public init(summary: String, code: String? = nil) {
    self.summary = summary
    self.code = code
  }
}
