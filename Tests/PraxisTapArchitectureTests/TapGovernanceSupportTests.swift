import Testing
@testable import PraxisTapGovernance
@testable import PraxisTapReview
@testable import PraxisTapRuntime
@testable import PraxisTapTypes

struct TapGovernanceSupportTests {
  @Test
  func tapContextModelsCaptureApertureRiskAndForbiddenObjects() {
    let projectSummary = PraxisContextSummarySlot(
      summary: "workspace ready",
      status: .ready,
      source: "test"
    )
    let risk = PraxisPlainLanguageRiskPayload(
      requestedAction: "run repo write tool",
      riskLevel: .risky,
      plainLanguageSummary: "这次会改工作区内容。",
      whyItIsRisky: "可能影响多个文件。",
      possibleConsequence: "改错会引入额外修复。",
      whatHappensIfNotRun: "当前任务会卡住。",
      availableUserActions: [
        .init(actionID: "approve-once", label: "继续", summary: "只执行这一次")
      ]
    )
    let aperture = PraxisReviewContextAperture(
      projectSummary: projectSummary,
      runSummary: .init(summary: "run active", status: .ready),
      userIntentSummary: .init(summary: "fix build", status: .ready),
      inventorySnapshot: .init(totalCapabilities: 2, availableCapabilityIDs: []),
      riskSummary: risk,
      sections: [
        .init(
          sectionID: "code",
          title: "代码范围",
          summary: "只动 Sources/",
          status: .ready,
          freshness: .fresh,
          trustLevel: .verified
        )
      ],
      forbiddenObjects: [
        .init(kind: .secretLiteral, summary: "secret must never enter aperture")
      ],
      mode: .standard
    )

    #expect(aperture.riskSummary.riskLevel == .risky)
    #expect(aperture.sections.first?.trustLevel == .verified)
    #expect(aperture.forbiddenObjects.first?.kind == .secretLiteral)
  }

  @Test
  func tapSupportModelsCoverSafetyToolReviewAndReplay() async throws {
    let safetyDecision = PraxisTapSafetyDecision(
      outcome: .escalateToHuman,
      summary: "dangerous capability requires approval",
      downgradedMode: .restricted
    )
    let session = PraxisToolReviewSessionSnapshot(
      sessionID: "tool-review-session",
      status: .waitingHuman,
      actions: [
        .init(
          reviewID: "review-1",
          sessionID: "tool-review-session",
          governanceKind: .activation,
          status: .waitingHuman,
          summary: "waiting for human gate",
          recordedAt: "2026-04-10T12:00:00Z"
        )
      ]
    )
    let signal = PraxisToolReviewGovernanceSignal(
      kind: .governanceSnapshot,
      active: true,
      summary: "inspection keeps governance evidence host-neutral"
    )
    let runtimeSnapshot = PraxisTapRuntimeSnapshot(
      controlPlaneState: .init(
        sessionID: .init(rawValue: "session-1"),
        governance: .init(mode: .standard, riskLevel: .risky, capabilityIDs: []),
        humanGateState: .waitingApproval
      ),
      checkpointPointer: nil
    )
    let coordinator = PraxisTapRuntimeCoordinator(snapshot: runtimeSnapshot)
    let storedSnapshot = await coordinator.snapshot

    #expect(safetyDecision.outcome == .escalateToHuman)
    #expect(session.actions.first?.governanceKind == .activation)
    #expect(signal.kind == .governanceSnapshot)
    #expect(storedSnapshot?.controlPlaneState.humanGateState == .waitingApproval)
  }
}
