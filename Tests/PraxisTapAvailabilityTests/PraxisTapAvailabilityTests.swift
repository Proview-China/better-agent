import Testing
import PraxisCapabilityContracts
@testable import PraxisTapAvailability
@testable import PraxisTapTypes

struct PraxisTapAvailabilityTests {
  @Test
  func availabilityAuditorFiltersNilCapabilitiesAndPrioritizesBacklog() {
    let auditor = PraxisAvailabilityAuditor()
    let backlogCapability = PraxisCapabilityID(rawValue: "shell.exec")
    let report = auditor.audit(
      rules: [
        .init(capabilityID: nil, summary: "missing capability", requiredMode: .standard, reviewRequired: true),
        .init(capabilityID: backlogCapability, summary: "shell backlog", requiredMode: .standard)
      ],
      currentMode: .standard,
      backlogCapabilities: [backlogCapability]
    )

    #expect(report.records.count == 1)
    #expect(report.records.first?.capabilityID == backlogCapability)
    #expect(report.records.first?.decision == .pendingBacklog)
    #expect(report.records.first?.failures == [.dependencyMissing])
    #expect(report.state == .unavailable)
  }

  @Test
  func availabilityAuditorReturnsAvailableForEmptyRules() {
    let auditor = PraxisAvailabilityAuditor()
    let report = auditor.audit(rules: [], currentMode: .standard)

    #expect(report.records.isEmpty)
    #expect(report.state == .available)
  }
}
