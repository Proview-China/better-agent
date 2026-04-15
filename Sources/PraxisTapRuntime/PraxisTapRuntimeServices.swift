import PraxisTapProvision
import PraxisTapTypes

/// Service that owns pure runtime transition rules between provision results and replay or human-gate state.
public struct PraxisActivationLifecycleService: Sendable {
  public init() {}

  /// Maps a provisioning-layer replay policy into a replay policy that runtime can consume directly.
  ///
  /// - Parameters:
  ///   - policy: The replay policy declared by the provision layer.
  /// - Returns: The runtime-side replay policy snapshot.
  public func replayPolicy(for policy: PraxisProvisionReplayPolicy) -> PraxisReplayPolicy {
    switch policy {
    case .none:
      return PraxisReplayPolicy(
        allowsResume: false,
        allowsHumanOverride: false,
        nextAction: .none,
        summary: "Replay is disabled for this provision result."
      )
    case .manual:
      return PraxisReplayPolicy(
        allowsResume: true,
        allowsHumanOverride: true,
        nextAction: .manual,
        summary: "Replay can continue only after an explicit manual resume or approved human handoff."
      )
    case .autoAfterVerify:
      return PraxisReplayPolicy(
        allowsResume: true,
        allowsHumanOverride: false,
        nextAction: .verifyThenAuto,
        summary: "Replay is staged for automatic continue after verification succeeds."
      )
    case .reReviewThenDispatch:
      return PraxisReplayPolicy(
        allowsResume: true,
        allowsHumanOverride: false,
        nextAction: .reReviewThenDispatch,
        summary: "Replay is staged for re-review before dispatch once activation is ready."
      )
    }
  }

  /// Creates a pending replay record for runtime.
  ///
  /// - Parameters:
  ///   - replayID: The stable identifier for the replay record.
  ///   - capabilityKey: The associated capability identifier.
  ///   - policy: The provisioning policy that the replay should follow.
  /// - Returns: A pending replay record that can be written into the runtime snapshot.
  public func createPendingReplay(
    replayID: String,
    capabilityKey: String,
    policy: PraxisProvisionReplayPolicy
  ) -> PraxisPendingReplay {
    let replayPolicy = replayPolicy(for: policy)
    let status: PraxisReplayStatus = replayPolicy.nextAction == .none ? .skipped : .pending

    return PraxisPendingReplay(
      replayID: replayID,
      capabilityKey: capabilityKey,
      policy: policy,
      status: status,
      nextAction: replayPolicy.nextAction,
      summary: replayPolicy.summary,
      recommendedAction: replayPolicy.nextAction.rawValue
    )
  }

  /// Marks one activation attempt as completed and synthesizes a host-neutral activation receipt.
  ///
  /// - Parameters:
  ///   - attempt: The activation attempt being finalized.
  ///   - bindingKey: The stable binding identifier produced by the host-neutral activation path.
  ///   - activatedAt: The timestamp when activation finished.
  /// - Returns: The updated activation attempt and one synthesized activation receipt.
  public func completeActivation(
    _ attempt: PraxisActivationAttemptRecord,
    bindingKey: String,
    activatedAt: String
  ) -> (attempt: PraxisActivationAttemptRecord, receipt: PraxisActivationReceipt) {
    (
      attempt: .init(
        attemptID: attempt.attemptID,
        capabilityKey: attempt.capabilityKey,
        status: .completed,
        createdAt: attempt.createdAt
      ),
      receipt: .init(
        capabilityKey: attempt.capabilityKey,
        bindingKey: bindingKey,
        activatedAt: activatedAt
      )
    )
  }

  /// Advances one replay record from staged to ready.
  ///
  /// - Parameter replay: The replay record to update.
  /// - Returns: A replay record that is ready to be consumed by a later dispatch or resume path.
  public func markReplayReady(_ replay: PraxisPendingReplay) -> PraxisPendingReplay {
    PraxisPendingReplay(
      replayID: replay.replayID,
      capabilityKey: replay.capabilityKey,
      policy: replay.policy,
      status: replay.status == .skipped ? .skipped : .ready,
      nextAction: replay.nextAction,
      summary: replay.status == .skipped
        ? replay.summary
        : "Replay \(replay.replayID) is ready for \(replay.nextAction.rawValue).",
      recommendedAction: replay.status == .skipped ? replay.recommendedAction : replay.nextAction.rawValue
    )
  }

  /// Marks one replay record as consumed after dispatch or resume succeeds.
  ///
  /// - Parameter replay: The replay record to update.
  /// - Returns: A replay record that no longer requires follow-up action.
  public func consumeReplay(_ replay: PraxisPendingReplay) -> PraxisPendingReplay {
    PraxisPendingReplay(
      replayID: replay.replayID,
      capabilityKey: replay.capabilityKey,
      policy: replay.policy,
      status: replay.status == .skipped ? .skipped : .consumed,
      nextAction: replay.status == .skipped ? replay.nextAction : .none,
      summary: replay.status == .skipped
        ? replay.summary
        : "Replay \(replay.replayID) has been consumed by a resumed dispatch path.",
      recommendedAction: replay.status == .skipped ? replay.recommendedAction : "none"
    )
  }

  /// Applies a human-gate state transition to a runtime snapshot and returns the updated snapshot.
  ///
  /// - Parameters:
  ///   - humanGateState: The human-gate state to write.
  ///   - snapshot: The previous TAP runtime snapshot.
  ///   - eventID: The event identifier associated with the state transition.
  ///   - summary: A human-readable summary of the transition.
  ///   - createdAt: The timestamp when the event occurred.
  /// - Returns: A new TAP runtime snapshot containing the appended human-gate event and latest state.
  public func apply(
    humanGateState: PraxisHumanGateState,
    to snapshot: PraxisTapRuntimeSnapshot,
    eventID: String,
    summary: String,
    createdAt: String
  ) -> PraxisTapRuntimeSnapshot {
    let event = PraxisHumanGateEvent(
      eventID: eventID,
      state: humanGateState,
      summary: summary,
      createdAt: createdAt
    )
    return PraxisTapRuntimeSnapshot(
      controlPlaneState: PraxisTapControlPlaneState(
        sessionID: snapshot.controlPlaneState.sessionID,
        governance: snapshot.controlPlaneState.governance,
        humanGateState: humanGateState
      ),
      checkpointPointer: snapshot.checkpointPointer,
      pendingReplays: snapshot.pendingReplays,
      humanGateEvents: snapshot.humanGateEvents + [event]
    )
  }
}

/// Minimal actor-backed TAP runtime store.
/// This type stores runtime snapshots and event history for tests and future host assembly.
public actor PraxisTapRuntimeCoordinator {
  public private(set) var snapshot: PraxisTapRuntimeSnapshot?

  public init(snapshot: PraxisTapRuntimeSnapshot? = nil) {
    self.snapshot = snapshot
  }

  /// Replaces the currently stored runtime snapshot.
  ///
  /// - Parameters:
  ///   - snapshot: The new runtime snapshot to store.
  /// - Returns: None.
  public func store(_ snapshot: PraxisTapRuntimeSnapshot) {
    self.snapshot = snapshot
  }

  /// Appends a human-gate event and synchronizes the corresponding state back into the control-plane state.
  ///
  /// - Parameters:
  ///   - humanGateEvent: The human-gate event to record.
  /// - Returns: None.
  public func record(humanGateEvent: PraxisHumanGateEvent) {
    guard let snapshot else { return }
    self.snapshot = PraxisTapRuntimeSnapshot(
      controlPlaneState: PraxisTapControlPlaneState(
        sessionID: snapshot.controlPlaneState.sessionID,
        governance: snapshot.controlPlaneState.governance,
        humanGateState: humanGateEvent.state
      ),
      checkpointPointer: snapshot.checkpointPointer,
      pendingReplays: snapshot.pendingReplays,
      humanGateEvents: snapshot.humanGateEvents + [humanGateEvent]
    )
  }

  /// Adds a replay record to the pending replay list of the current runtime snapshot.
  ///
  /// - Parameters:
  ///   - replay: The pending replay record to append to the snapshot.
  /// - Returns: None.
  public func stageReplay(_ replay: PraxisPendingReplay) {
    guard let snapshot else { return }
    self.snapshot = PraxisTapRuntimeSnapshot(
      controlPlaneState: snapshot.controlPlaneState,
      checkpointPointer: snapshot.checkpointPointer,
      pendingReplays: snapshot.pendingReplays + [replay],
      humanGateEvents: snapshot.humanGateEvents
    )
  }
}
