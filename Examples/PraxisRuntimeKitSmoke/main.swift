import Foundation
import PraxisMpTypes
import PraxisRuntimeKit

private enum PraxisRuntimeKitSmokeSuite: String, CaseIterable {
  case run
  case cmpTap = "cmp-tap"
  case mp
  case capabilities
  case all

  static func parse(_ rawValue: String?) throws -> PraxisRuntimeKitSmokeSuite {
    guard let rawValue else {
      return .all
    }
    guard let suite = PraxisRuntimeKitSmokeSuite(rawValue: rawValue) else {
      throw PraxisRuntimeKitSmokeFailure.invalidArguments(
        "Unsupported suite '\(rawValue)'. Use one of: \(allCases.map(\.rawValue).joined(separator: ", "))."
      )
    }
    return suite
  }
}

private enum PraxisRuntimeKitSmokeStatus: String {
  case passed = "passed"
  case failed = "failed"
}

private struct PraxisRuntimeKitSmokeResult {
  let suite: PraxisRuntimeKitSmokeSuite
  let status: PraxisRuntimeKitSmokeStatus
  let summary: String
  let remediation: String?
}

private enum PraxisRuntimeKitSmokeFailure: Error {
  case assertion(String)
  case invalidArguments(String)
  case suiteFailures([PraxisRuntimeKitSmokeResult])
}

extension PraxisRuntimeKitSmokeFailure: LocalizedError {
  var errorDescription: String? {
    switch self {
    case .assertion(let message), .invalidArguments(let message):
      return message
    case .suiteFailures(let results):
      let failed = results.filter { $0.status == .failed }
      return "Smoke failed for \(failed.count) suite(s): \(failed.map(\.suite.rawValue).joined(separator: ", "))."
    }
  }
}

private struct PraxisRuntimeKitSmokeHarness {
  let rootDirectory: URL
  let client: PraxisRuntimeClient

  init(rootDirectory: URL) throws {
    self.rootDirectory = rootDirectory
    self.client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
  }

  func run(_ suite: PraxisRuntimeKitSmokeSuite) async -> [PraxisRuntimeKitSmokeResult] {
    switch suite {
    case .run:
      return [await execute(.run, body: runSuite)]
    case .cmpTap:
      return [await execute(.cmpTap, body: cmpTapSuite)]
    case .mp:
      return [await execute(.mp, body: mpSuite)]
    case .capabilities:
      return [await execute(.capabilities, body: capabilitiesSuite)]
    case .all:
      return [
        await execute(.run, body: runSuite),
        await execute(.cmpTap, body: cmpTapSuite),
        await execute(.mp, body: mpSuite),
        await execute(.capabilities, body: capabilitiesSuite),
      ]
    }
  }

  private func execute(
    _ suite: PraxisRuntimeKitSmokeSuite,
    body: () async throws -> String
  ) async -> PraxisRuntimeKitSmokeResult {
    do {
      return PraxisRuntimeKitSmokeResult(
        suite: suite,
        status: .passed,
        summary: try await body(),
        remediation: nil
      )
    } catch {
      let diagnostic = PraxisRuntimeErrorDiagnostics.diagnose(error)
      return PraxisRuntimeKitSmokeResult(
        suite: suite,
        status: .failed,
        summary: diagnostic.summary,
        remediation: diagnostic.remediation
      )
    }
  }

  private func runSuite() async throws -> String {
    let started = try await client.runs.run(
      task: "Summarize repository status",
      sessionID: "session.runtime-kit-smoke"
    )
    let resumed = try await client.runs.resume(.init(started.runID.rawValue))

    try require(started.runID == resumed.runID, "Run smoke expected resumed run ID to match the started run.")
    try require(started.sessionID == resumed.sessionID, "Run smoke expected resumed session ID to match the started session.")

    return "runID=\(started.runID.rawValue) lifecycle=\(resumed.lifecycleDisposition.rawValue) summary=\(resumed.phaseSummary)"
  }

  private func cmpTapSuite() async throws -> String {
    let cmpProject = client.cmp.project("cmp.local-runtime")
    let tapProject = client.tap.project("cmp.local-runtime")

    _ = try await cmpProject.openSession("cmp.runtime-kit-smoke")
    _ = try await cmpProject.approvals.request(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        requestedTier: .b1,
        summary: "Escalate git access to checker"
      )
    )
    let decision = try await cmpProject.approvals.decide(
      .init(
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        capabilityID: "tool.git",
        decision: .approve,
        reviewerAgentID: "reviewer.local",
        decisionSummary: "Approved git access for checker"
      )
    )
    let smoke = try await cmpProject.smoke()
    let tapOverview = try await tapProject.overview(for: "checker.local", limit: 10)

    try require(decision.outcome == .approvedByHuman, "CMP + TAP smoke expected approved git access.")
    try require(
      tapOverview.status.availableCapabilityIDs.map(\.rawValue).contains("tool.git"),
      "CMP + TAP smoke expected tool.git to appear in TAP availability."
    )

    return "projectID=\(smoke.projectID) smokeChecks=\(smoke.smokeResult.checks.count) tapHistory=\(tapOverview.history.totalCount)"
  }

  private func mpSuite() async throws -> String {
    let project = client.mp.project("mp.local-runtime")

    let overview = try await project.overview(limit: 5)
    let smoke = try await project.smoke()
    let search = try await project.search(query: "onboarding", scopeLevels: [.project], limit: 5)
    let resolve = try await project.resolve(
      query: "onboarding",
      requesterAgent: "runtime.local",
      scopeLevels: [.project],
      limit: 5
    )
    let history = try await project.history(
      query: "onboarding",
      requesterAgent: "runtime.local",
      reason: "Need historical context",
      scopeLevels: [.project],
      limit: 5
    )

    try require(overview.projectID == "mp.local-runtime", "MP smoke expected the project overview to keep the scoped project ID.")
    try require(smoke.projectID == "mp.local-runtime", "MP smoke expected the smoke snapshot to keep the scoped project ID.")
    try require(search.query == "onboarding", "MP smoke expected the search query to round-trip unchanged.")
    try require(resolve.query == "onboarding", "MP smoke expected the resolve query to round-trip unchanged.")
    try require(history.query == "onboarding", "MP smoke expected the history query to round-trip unchanged.")

    return "projectID=\(overview.projectID) smokeChecks=\(smoke.smokeResult.checks.count) hits=\(search.hits.count)"
  }

  private func capabilitiesSuite() async throws -> String {
    let catalog = client.capabilities.catalog()
    let openedSession = try await client.capabilities.openSession(
      .init(
        sessionID: "runtime.capabilities.smoke",
        title: "Runtime Capability Smoke"
      )
    )
    let generated = try await client.capabilities.generate(
      .init(
        prompt: "Summarize the local thin capability baseline",
        preferredModel: "local-smoke-model",
        requiredCapabilities: ["generate.create", "embed.create"]
      )
    )
    let streamed = try await client.capabilities.stream(
      .init(
        prompt: "Stream a short capability summary",
        preferredModel: "local-smoke-model"
      ),
      chunkCharacterCount: 32
    )
    let embedded = try await client.capabilities.embed(
      .init(
        content: "phase three thin capability baseline",
        preferredModel: "local-embed-smoke"
      )
    )
    let toolCall = try await client.capabilities.callTool(
      .init(
        toolName: "web.search",
        summary: "Find RuntimeKit capability docs",
        serverName: "local-smoke"
      )
    )
    let uploadedFile = try await client.capabilities.uploadFile(
      .init(
        summary: "runtime capability smoke artifact",
        purpose: "analysis"
      )
    )
    let submittedBatch = try await client.capabilities.submitBatch(
      .init(
        summary: "runtime capability smoke batch",
        itemCount: 2
      )
    )

    try require(catalog.capabilityIDs.map(\.rawValue).contains("generate.create"), "Capability smoke expected generate.create in the thin capability catalog.")
    try require(catalog.capabilityIDs.map(\.rawValue).contains("session.open"), "Capability smoke expected session.open in the thin capability catalog.")
    try require(openedSession.sessionID.rawValue == "runtime.capabilities.smoke", "Capability smoke expected the opened session ID to round-trip unchanged.")
    try require(generated.outputText.isEmpty == false, "Capability smoke expected generate.create to produce output.")
    try require(streamed.chunks.isEmpty == false, "Capability smoke expected generate.stream to project at least one chunk.")
    try require(embedded.vectorLength > 0, "Capability smoke expected embed.create to return a positive vector length.")
    try require(toolCall.toolName == "web.search", "Capability smoke expected tool.call to round-trip the tool name.")
    try require(uploadedFile.fileID.isEmpty == false, "Capability smoke expected file.upload to return a stable file ID.")
    try require(submittedBatch.batchID.isEmpty == false, "Capability smoke expected batch.submit to return a stable batch ID.")

    return "catalogEntries=\(catalog.entries.count) session=\(openedSession.sessionID.rawValue) streamChunks=\(streamed.chunks.count) batchID=\(submittedBatch.batchID)"
  }

  private func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else {
      throw PraxisRuntimeKitSmokeFailure.assertion(message)
    }
  }
}

private enum PraxisRuntimeKitSmokeArguments {
  static func parse(_ arguments: [String]) throws -> (suite: PraxisRuntimeKitSmokeSuite, rootDirectory: URL) {
    var suiteRawValue: String?
    var rootDirectoryPath: String?

    var index = 0
    while index < arguments.count {
      switch arguments[index] {
      case "--suite":
        index += 1
        guard index < arguments.count else {
          throw PraxisRuntimeKitSmokeFailure.invalidArguments("Missing value after --suite.")
        }
        suiteRawValue = arguments[index]
      case "--root":
        index += 1
        guard index < arguments.count else {
          throw PraxisRuntimeKitSmokeFailure.invalidArguments("Missing value after --root.")
        }
        rootDirectoryPath = arguments[index]
      case "--help", "-h":
        throw PraxisRuntimeKitSmokeFailure.invalidArguments(
          "Usage: swift run PraxisRuntimeKitSmoke [--suite run|cmp-tap|mp|capabilities|all] [--root /tmp/praxis-runtime-kit-smoke]"
        )
      default:
        throw PraxisRuntimeKitSmokeFailure.invalidArguments("Unknown argument '\(arguments[index])'.")
      }
      index += 1
    }

    let suite = try PraxisRuntimeKitSmokeSuite.parse(suiteRawValue)
    let rootDirectory: URL
    if let rootDirectoryPath {
      rootDirectory = URL(fileURLWithPath: rootDirectoryPath, isDirectory: true)
    } else {
      rootDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("praxis-runtime-kit-smoke", isDirectory: true)
        .appendingPathComponent(UUID().uuidString.lowercased(), isDirectory: true)
    }

    return (suite, rootDirectory)
  }
}

@main
struct PraxisRuntimeKitSmokeMain {
  static func main() async throws {
    let parsed = try PraxisRuntimeKitSmokeArguments.parse(Array(CommandLine.arguments.dropFirst()))
    try FileManager.default.createDirectory(at: parsed.rootDirectory, withIntermediateDirectories: true)

    let harness = try PraxisRuntimeKitSmokeHarness(rootDirectory: parsed.rootDirectory)
    let results = await harness.run(parsed.suite)

    print("Praxis RuntimeKit Smoke")
    print("rootDirectory: \(parsed.rootDirectory.path)")
    print("suite: \(parsed.suite.rawValue)")
    for result in results {
      print("[\(result.status.rawValue)] \(result.suite.rawValue): \(result.summary)")
      if let remediation = result.remediation {
        print("  remediation: \(remediation)")
      }
    }

    let failedResults = results.filter { $0.status == .failed }
    if !failedResults.isEmpty {
      throw PraxisRuntimeKitSmokeFailure.suiteFailures(failedResults)
    }
  }
}
