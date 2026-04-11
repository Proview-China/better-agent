import Testing
import PraxisCapabilityContracts
@testable import PraxisTapGovernance
@testable import PraxisTapReview
@testable import PraxisTapTypes

struct PraxisTapReviewTests {
  @Test
  func reviewDecisionEngineRejectsMissingAndDeniedCapabilities() {
    let engine = PraxisReviewDecisionEngine()
    let profile = PraxisTapCapabilityProfile(
      profileID: "review.profile",
      agentClass: "reviewer",
      defaultMode: .standard,
      baselineTier: .b1,
      deniedCapabilityPatterns: ["shell.exec"]
    )

    let missingCapability = engine.route(
      request: .init(
        reviewKind: .tool,
        capabilityID: nil,
        requestedTier: .b1,
        mode: .standard,
        riskLevel: .risky,
        summary: "missing capability"
      ),
      profile: profile
    )
    let deniedCapability = engine.route(
      request: .init(
        reviewKind: .tool,
        capabilityID: .init(rawValue: "shell.exec"),
        requestedTier: .b1,
        mode: .standard,
        riskLevel: .risky,
        summary: "denied capability"
      ),
      profile: profile,
      inventory: .init(availableCapabilityIDs: [.init(rawValue: "shell.exec")])
    )

    #expect(missingCapability.outcome == .denied)
    #expect(missingCapability.decision.route == .reject)
    #expect(deniedCapability.outcome == .denied)
    #expect(deniedCapability.decision.vote == .deny)
  }

  @Test
  func reviewerCoordinatorKeepsLatestDecisionAndTrailInSync() async {
    let coordinator = PraxisReviewerCoordinator()
    let first = PraxisReviewDecision(route: .toolReview, summary: "first decision")
    let second = PraxisReviewDecision(route: .humanReview, summary: "second decision")

    await coordinator.record(first)
    await coordinator.record(second)

    let latestDecision = await coordinator.latestDecision
    let trail = await coordinator.trail

    #expect(latestDecision == second)
    #expect(trail.decisions.count == 2)
    #expect(trail.latestDecision == second)
  }
}
