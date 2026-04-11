import Testing
import PraxisSession
@testable import PraxisTapGovernance
@testable import PraxisTapProvision
@testable import PraxisTapRuntime
@testable import PraxisTapTypes

struct PraxisTapRuntimeTests {
  @Test
  func activationLifecycleMapsReplayPoliciesAndPendingReplayStatus() {
    let lifecycle = PraxisActivationLifecycleService()

    let nonePolicy = lifecycle.replayPolicy(for: .none)
    let manualPolicy = lifecycle.replayPolicy(for: .manual)
    let autoPolicy = lifecycle.replayPolicy(for: .autoAfterVerify)
    let reviewPolicy = lifecycle.replayPolicy(for: .reReviewThenDispatch)
    let skippedReplay = lifecycle.createPendingReplay(
      replayID: "replay.none",
      capabilityKey: "shell.exec",
      policy: .none
    )

    #expect(!nonePolicy.allowsResume)
    #expect(nonePolicy.nextAction == .none)
    #expect(manualPolicy.nextAction == .manual)
    #expect(autoPolicy.nextAction == .verifyThenAuto)
    #expect(reviewPolicy.nextAction == .reReviewThenDispatch)
    #expect(skippedReplay.status == .skipped)
  }

  @Test
  func tapRuntimeCoordinatorNoopsWithoutSnapshotAndStagesReplayWithSnapshot() async {
    let emptyCoordinator = PraxisTapRuntimeCoordinator()
    await emptyCoordinator.record(
      humanGateEvent: .init(
        eventID: "evt.1",
        state: .waitingApproval,
        summary: "noop without snapshot",
        createdAt: "2026-04-11T10:00:00Z"
      )
    )
    #expect(await emptyCoordinator.snapshot == nil)

    let snapshot = PraxisTapRuntimeSnapshot(
      controlPlaneState: .init(
        sessionID: .init(rawValue: "session.tap"),
        governance: .init(mode: .standard, riskLevel: .risky, capabilityIDs: []),
        humanGateState: .notRequired
      ),
      checkpointPointer: nil
    )
    let coordinator = PraxisTapRuntimeCoordinator(snapshot: snapshot)
    let replay = PraxisPendingReplay(
      replayID: "replay.1",
      capabilityKey: "shell.exec",
      policy: .manual,
      status: .pending,
      nextAction: .manual,
      summary: "manual replay",
      recommendedAction: "manual"
    )

    await coordinator.stageReplay(replay)
    await coordinator.record(
      humanGateEvent: .init(
        eventID: "evt.2",
        state: .approved,
        summary: "approved",
        createdAt: "2026-04-11T10:05:00Z"
      )
    )
    let stored = await coordinator.snapshot

    #expect(stored?.pendingReplays == [replay])
    #expect(stored?.humanGateEvents.count == 1)
    #expect(stored?.controlPlaneState.humanGateState == .approved)
  }
}
