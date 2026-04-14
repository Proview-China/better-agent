import Foundation
import PraxisRuntimeKit

private func makeRuntimeRoot(named name: String) throws -> URL {
  let rootDirectory = FileManager.default.temporaryDirectory
    .appendingPathComponent("praxis-examples", isDirectory: true)
    .appendingPathComponent(name, isDirectory: true)
  try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
  return rootDirectory
}

@main
struct PraxisRuntimeKitRunExample {
  static func main() async throws {
    let rootDirectory = try makeRuntimeRoot(named: "runtime-kit-run")
    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)

    let started = try await client.runs.run(
      .init(
        task: "Summarize repository status",
        sessionID: "session.runtime-kit-example"
      )
    )
    let resumed = try await client.runs.resumeRun(.init(started.runID.rawValue))

    print("Praxis RuntimeKit Run Example")
    print("rootDirectory: \(rootDirectory.path)")
    print("started.runID: \(started.runID.rawValue)")
    print("started.sessionID: \(started.sessionID.rawValue)")
    print("started.phase: \(started.phase.rawValue)")
    print("started.lifecycle: \(started.lifecycleDisposition.rawValue)")
    print("started.summary: \(started.phaseSummary)")
    print("resumed.runID: \(resumed.runID.rawValue)")
    print("resumed.lifecycle: \(resumed.lifecycleDisposition.rawValue)")
    print("resumed.summary: \(resumed.phaseSummary)")
  }
}
