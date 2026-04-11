import Testing
@testable import PraxisTapGovernance
@testable import PraxisTapTypes

struct PraxisTapGovernanceTests {
  @Test
  func riskClassifierNormalizesPatternsAndModePolicyTracksSafetyAirbag() {
    let classifier = PraxisDefaultRiskClassifier(
      riskyCapabilityPatterns: [" shell.exec ", "", "shell.exec", "shell.* "],
      dangerousCapabilityPatterns: [" git.reset.hard ", "git.reset.hard", " "]
    )
    let provider = PraxisDefaultModePolicyProvider()

    #expect(classifier.riskyCapabilityPatterns == ["shell.exec", "shell.*"])
    #expect(classifier.dangerousCapabilityPatterns == ["git.reset.hard"])

    let dangerous = classifier.classify(capabilityKey: "git.reset.hard", requestedTier: .b1)
    let yoloEntry = provider.modePolicyEntry(mode: .yolo, tier: .b2)
    let standardEntry = provider.modePolicyEntry(mode: .standard, tier: .b2)

    #expect(dangerous.riskLevel == .dangerous)
    #expect(dangerous.matchedPattern == "git.reset.hard")
    #expect(yoloEntry.actsAsSafetyAirbag)
    #expect(!yoloEntry.requiresReview)
    #expect(standardEntry.requiresReview)
    #expect(!standardEntry.allowsAutoGrant)
  }

  @Test
  func safetyInterceptorEscalatesHumanGateForRestrictedDangerousRequest() {
    let interceptor = PraxisDefaultSafetyInterceptor()
    let decision = interceptor.evaluate(
      .init(
        mode: .restricted,
        requestedTier: .b2,
        capabilityKey: "workspace.outside.write",
        requestedOperation: "write outside workspace",
        riskLevel: .dangerous
      )
    )

    #expect(decision.outcome == .escalateToHuman)
    #expect(decision.downgradedMode == .restricted)
  }
}
