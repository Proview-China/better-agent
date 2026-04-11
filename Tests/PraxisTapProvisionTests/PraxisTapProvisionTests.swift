import Testing
import PraxisCapabilityContracts
@testable import PraxisTapProvision
@testable import PraxisTapTypes

struct PraxisTapProvisionTests {
  @Test
  func provisionRegistryReplacesEntriesWithSameAssetName() {
    var registry = PraxisProvisionRegistry()
    registry.register(
      .init(
        asset: .init(name: "shell package", capabilityID: .init(rawValue: "shell.exec"), status: .readyForReview),
        supportedModes: [.permissive],
        summary: "old"
      )
    )
    registry.register(
      .init(
        asset: .init(name: "shell package", capabilityID: .init(rawValue: "shell.exec"), status: .active),
        supportedModes: [.standard],
        summary: "new"
      )
    )

    #expect(registry.entries.count == 1)
    #expect(registry.entries.first?.asset.status == .active)
    #expect(registry.entries.first?.supportedModes == [.standard])
  }

  @Test
  func provisionPlannerBuildsDefaultVerificationWhenNoAssetsAreReady() {
    let planner = PraxisProvisionPlanner()
    let plan = planner.plan(
      .init(
        kind: .capability,
        capabilityID: .init(rawValue: "shell.exec"),
        requestedTier: .b1,
        mode: .permissive,
        summary: "provision shell tooling",
        requiredVerification: [],
        replayPolicy: .autoAfterVerify
      )
    )

    #expect(plan.selectedAssets.isEmpty)
    #expect(plan.requiresApproval)
    #expect(plan.verificationPlan == ["Run smoke verification for shell.exec."])
  }
}
