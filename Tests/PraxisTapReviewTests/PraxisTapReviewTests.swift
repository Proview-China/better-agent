import Foundation
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

  @Test
  func governanceSignalCodecPreservesStableRawValueShape() throws {
    let signal = PraxisToolReviewGovernanceSignal(
      kind: .governanceSnapshot,
      active: true,
      summary: "governance evidence is available"
    )

    let encoded = try JSONEncoder().encode(signal)
    let json = try #require(String(data: encoded, encoding: .utf8))
    let decoded = try JSONDecoder().decode(PraxisToolReviewGovernanceSignal.self, from: encoded)

    #expect(json.contains("\"kind\":\"governance_snapshot\""))
    #expect(decoded.kind == PraxisToolReviewGovernanceSignalKind.governanceSnapshot)
  }

  @Test
  func governanceSignalCodecRejectsUnknownRawValue() {
    let payload = """
      {
        "kind": "unknown_signal",
        "active": true,
        "summary": "unsupported"
      }
      """.data(using: .utf8)!

    #expect(throws: DecodingError.self) {
      try JSONDecoder().decode(PraxisToolReviewGovernanceSignal.self, from: payload)
    }
  }
}
