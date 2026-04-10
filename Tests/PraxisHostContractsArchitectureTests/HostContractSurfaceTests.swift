import XCTest
@testable import PraxisInfraContracts
@testable import PraxisProviderContracts
@testable import PraxisToolingContracts

final class HostContractSurfaceTests: XCTestCase {
  func testProviderContractsNowCoverWebSearchSurface() {
    let request = PraxisProviderWebSearchRequest(query: "Swift Package Manager", locale: "zh-CN")
    let response = PraxisProviderWebSearchResponse(
      query: request.query,
      results: [
        .init(title: "SwiftPM", snippet: "Apple package manager", url: "https://example.com/swiftpm")
      ]
    )

    XCTAssertEqual(request.locale, "zh-CN")
    XCTAssertEqual(response.results.count, 1)
    XCTAssertEqual(response.results.first?.title, "SwiftPM")
  }

  func testInfraContractsCoverLocalPersistenceAndSemanticSearchSurface() {
    let truth = PraxisDeliveryTruthRecord(
      id: "delivery-1",
      topic: "cmp.peer.sync",
      status: .published,
      payloadSummary: "peer context package dispatched",
      updatedAt: "2026-04-10T12:00:00Z"
    )
    let embedding = PraxisEmbeddingRecord(
      id: "embedding-1",
      contentSummary: "section summary",
      vectorLength: 1536,
      storageKey: "sqlite://chunks/section-1"
    )
    let search = PraxisSemanticSearchRequest(
      query: "find section summary",
      limit: 3,
      candidateStorageKeys: [embedding.storageKey]
    )
    let match = PraxisSemanticSearchMatch(
      id: "match-1",
      score: 0.91,
      contentSummary: embedding.contentSummary,
      storageKey: embedding.storageKey
    )

    XCTAssertEqual(truth.status, .published)
    XCTAssertEqual(embedding.vectorLength, 1536)
    XCTAssertEqual(search.candidateStorageKeys, [embedding.storageKey])
    XCTAssertEqual(match.storageKey, embedding.storageKey)
  }

  func testToolingContractsCoverSystemGitReadinessSurface() {
    let report = PraxisGitAvailabilityReport(
      status: .installPromptExpected,
      notes: "macOS can prompt for Xcode Command Line Tools when git is first invoked."
    )

    XCTAssertEqual(report.status, .installPromptExpected)
    XCTAssertNil(report.executablePath)
  }
}
