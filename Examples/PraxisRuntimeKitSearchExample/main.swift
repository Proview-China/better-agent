import Foundation
import PraxisRuntimeKit

@main
struct PraxisRuntimeKitSearchExampleMain {
  static func main() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-kit-search-example", isDirectory: true)
      .appendingPathComponent(UUID().uuidString.lowercased(), isDirectory: true)
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let search = try await client.capabilities.searchWeb(
      .init(
        query: "Swift runtime capability search chain",
        locale: "en-US",
        preferredDomains: ["example.com", "docs.example.com"],
        limit: 2
      )
    )
    guard let firstResult = search.results.first else {
      print("No search results.")
      return
    }

    let fetched = try await client.capabilities.fetchSearchResult(
      .init(
        url: firstResult.url,
        preferredTitle: firstResult.title,
        waitPolicy: .networkIdle
      )
    )
    let grounded = try await client.capabilities.groundSearchResult(
      .init(
        taskSummary: "Verify one search result for runtime capability docs",
        exampleURL: fetched.finalURL,
        requestedFacts: ["final_url", "host", "page_title"],
        locale: "en-US",
        maxPages: 2
      )
    )

    print("Search summary: \(search.summary)")
    print("First result: \(firstResult.title) -> \(firstResult.url)")
    print("Fetched final URL: \(fetched.finalURL)")
    print("Grounded pages: \(grounded.pages.count)")
    print("Grounded facts: \(grounded.facts.map(\.name).joined(separator: ", "))")
  }
}
