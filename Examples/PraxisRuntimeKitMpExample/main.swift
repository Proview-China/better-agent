import Foundation
import PraxisMpTypes
import PraxisRuntimeKit

private func makeRuntimeRoot(named name: String) throws -> URL {
  let rootDirectory = FileManager.default.temporaryDirectory
    .appendingPathComponent("praxis-examples", isDirectory: true)
    .appendingPathComponent(name, isDirectory: true)
  try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
  return rootDirectory
}

@main
struct PraxisRuntimeKitMpExample {
  static func main() async throws {
    let rootDirectory = try makeRuntimeRoot(named: "runtime-kit-mp")
    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)

    let project = client.mp.project("mp.local-runtime")
    let overview = try await project.overview(.init(limit: 5))
    let search = try await project.search(
      .init(
        query: "onboarding",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let resolve = try await project.resolve(
      .init(
        query: "onboarding",
        requesterAgentID: "runtime.local",
        scopeLevels: [.project],
        limit: 5
      )
    )
    let history = try await project.history(
      .init(
        query: "onboarding",
        requesterAgentID: "runtime.local",
        reason: "Need historical context",
        scopeLevels: [.project],
        limit: 5
      )
    )

    print("Praxis RuntimeKit MP Example")
    print("rootDirectory: \(rootDirectory.path)")
    print("overview.projectID: \(overview.smoke.projectID)")
    print("overview.summary: \(overview.smoke.summary)")
    print("search.query: \(search.query)")
    print("search.resultCount: \(search.hits.count)")
    print("resolve.query: \(resolve.query)")
    print("resolve.primaryMemoryCount: \(resolve.primaryMemoryIDs.count)")
    print("resolve.supportingMemoryCount: \(resolve.supportingMemoryIDs.count)")
    print("history.query: \(history.query)")
    print("history.primaryMemoryCount: \(history.primaryMemoryIDs.count)")
    print("history.supportingMemoryCount: \(history.supportingMemoryIDs.count)")
    print("history.reason: \(history.reason)")
  }
}
