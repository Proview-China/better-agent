import Testing
@testable import PraxisCapabilityContracts
@testable import PraxisCapabilityResults

struct PraxisCapabilityResultNormalizerTests {
  @Test
  func normalizerBuildsSuccessEnvelopeFromTrimmedSummary() {
    let envelope = PraxisDefaultCapabilityResultNormalizer().normalize(
      rawSummary: "  returned 40 lines  ",
      capabilityID: .init(rawValue: "code.read")
    )

    #expect(envelope.status == .success)
    #expect(envelope.output?.summary == "returned 40 lines")
    #expect(envelope.failure == nil)
  }

  @Test
  func normalizerRejectsEmptySummaryAsInvalidResult() {
    let envelope = PraxisDefaultCapabilityResultNormalizer().normalize(
      rawSummary: "   ",
      capabilityID: .init(rawValue: "code.read")
    )

    #expect(envelope.status == .failed)
    #expect(envelope.output == nil)
    #expect(envelope.failure == .invalidResult("Capability result summary must not be empty."))
  }
}
