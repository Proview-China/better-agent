import Testing
@testable import PraxisCLI
import PraxisRuntimeInterface
import Foundation

private final class StubRuntimeInterface: @unchecked Sendable, PraxisRuntimeInterfaceServing {
  let bootstrap: PraxisRuntimeInterfaceSnapshot
  let response: PraxisRuntimeInterfaceResponse
  let bufferedEvents: [PraxisRuntimeInterfaceEvent]

  init(
    bootstrap: PraxisRuntimeInterfaceSnapshot = .init(
      kind: .architecture,
      title: "Stub Architecture",
      summary: "Stub bootstrap"
    ),
    response: PraxisRuntimeInterfaceResponse,
    bufferedEvents: [PraxisRuntimeInterfaceEvent] = []
  ) {
    self.bootstrap = bootstrap
    self.response = response
    self.bufferedEvents = bufferedEvents
  }

  func bootstrapSnapshot() -> PraxisRuntimeInterfaceSnapshot {
    bootstrap
  }

  func handle(_ request: PraxisRuntimeInterfaceRequest) async -> PraxisRuntimeInterfaceResponse {
    response
  }

  func snapshotEvents() async -> [PraxisRuntimeInterfaceEvent] {
    bufferedEvents
  }

  func drainEvents() async -> [PraxisRuntimeInterfaceEvent] {
    bufferedEvents
  }
}

struct PraxisCLITests {
  @Test
  func cliAppRendersInspectionCommands() async throws {
    let app = try PraxisCLIApp(configuration: .init(interactive: false))

    let architectureOutput = try await app.run(arguments: [])
    let cmpOutput = try await app.run(arguments: ["inspect-cmp"])

    #expect(architectureOutput.contains("Praxis Architecture"))
    #expect(cmpOutput.contains("CMP Inspection"))
    #expect(cmpOutput.contains("cmp.local-runtime"))
  }

  @Test
  func cliAppCanRenderAndDrainBufferedEvents() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-cli-tests-\(UUID().uuidString.lowercased())", isDirectory: true)
    let configuration = PraxisCLIConfiguration(interactive: false, stateRootDirectory: rootDirectory)
    let app = try PraxisCLIApp(configuration: configuration)

    let runOutput = try await app.run(arguments: ["run-goal", "CLI event smoke"])
    let drainedOutput = try await app.run(arguments: ["events", "--drain"])
    let emptyOutput = try await app.run(arguments: ["events"])

    #expect(runOutput.contains("Run run:session.cli."))
    #expect(runOutput.contains("Next action model_inference"))
    #expect(drainedOutput.contains("Drained events:"))
    #expect(drainedOutput.contains("run.started"))
    #expect(drainedOutput.contains("run.follow_up_ready"))
    #expect(emptyOutput == "No buffered events are available.")
  }

  @Test
  func cliHelpAndValidationStayDeterministic() throws {
    let parser = PraxisCLICommandParser()
    let renderer = PraxisTerminalRenderer()

    #expect(try parser.parse(["help"]) == .help)
    #expect(throws: PraxisCLIError.missingArgument("run-goal")) {
      try parser.parse(["run-goal"])
    }
    #expect(throws: PraxisCLIError.invalidFlag("--unknown")) {
      try parser.parse(["events", "--unknown"])
    }
    #expect(renderer.renderHelp().contains("run-goal <summary>"))
  }

  @Test
  func runGoalParserGeneratesDistinctGoalAndSessionIdentifiers() throws {
    let parser = PraxisCLICommandParser()
    let first = try parser.parse(["run-goal", "First CLI goal"])
    let second = try parser.parse(["run-goal", "Second CLI goal"])

    let firstPayload: PraxisRuntimeInterfaceRunGoalRequestPayload
    let secondPayload: PraxisRuntimeInterfaceRunGoalRequestPayload

    switch first {
    case .runtime(let command):
      guard case .runGoal(let payload) = command.request else {
        Issue.record("Expected first run-goal parse to produce a runGoal request.")
        return
      }
      firstPayload = payload
    default:
      Issue.record("Expected first run-goal parse to produce a runtime invocation.")
      return
    }

    switch second {
    case .runtime(let command):
      guard case .runGoal(let payload) = command.request else {
        Issue.record("Expected second run-goal parse to produce a runGoal request.")
        return
      }
      secondPayload = payload
    default:
      Issue.record("Expected second run-goal parse to produce a runtime invocation.")
      return
    }

    #expect(firstPayload.goalID != secondPayload.goalID)
    #expect(firstPayload.sessionID != secondPayload.sessionID)
    #expect(firstPayload.goalID.hasPrefix("cli.goal."))
    #expect(firstPayload.sessionID?.hasPrefix("session.cli.") == true)
  }

  @Test
  func cliAppThrowsRuntimeFailureForFailingResponses() async throws {
    let runtimeInterface = StubRuntimeInterface(
      response: .failure(
        error: .init(
          code: .checkpointNotFound,
          message: "No checkpoint record found for run run:missing:goal."
        )
      )
    )

    let app = PraxisCLIApp(
      configuration: .init(interactive: false),
      runtimeInterface: runtimeInterface
    )

    await #expect(throws: PraxisCLIError.runtimeFailure(
      .init(
        code: .checkpointNotFound,
        message: "No checkpoint record found for run run:missing:goal."
      )
    )) {
      _ = try await app.run(arguments: ["resume-run", "run:missing:goal"])
    }
  }

  @Test
  func cliAppCanConsumePortalAgnosticRuntimeInterface() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-cli-neutral-\(UUID().uuidString.lowercased())", isDirectory: true)
    let runtimeInterface = StubRuntimeInterface(
      response: .success(
        snapshot: .init(
          kind: .inspection,
          title: "Neutral Snapshot",
          summary: "Rendered from runtime interface only"
        ),
        events: [
          .init(name: .cmpStatusReadback, detail: "shared contract")
        ]
      )
    )

    let app = PraxisCLIApp(
      configuration: .init(interactive: false, stateRootDirectory: rootDirectory),
      runtimeInterface: runtimeInterface
    )

    let output = try await app.run(arguments: ["inspect-cmp"])

    #expect(output.contains("Neutral Snapshot"))
    #expect(output.contains("Rendered from runtime interface only"))
    #expect(output.contains("cmp.status.readback"))
  }

  @Test
  func cliEventsPersistAcrossIndependentAppInstances() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-cli-events-\(UUID().uuidString.lowercased())", isDirectory: true)
    let configuration = PraxisCLIConfiguration(interactive: false, stateRootDirectory: rootDirectory)

    let runApp = PraxisCLIApp(
      configuration: configuration,
      runtimeInterface: StubRuntimeInterface(
        response: .success(
          snapshot: .init(
            kind: .run,
            title: "Run run:session.cli.test:cli.goal.test",
            summary: "Started running",
            pendingIntentID: .init(rawValue: "intent-1")
          ),
          events: [
            .init(name: .runStarted, detail: "Started running"),
            .init(name: .runFollowUpReady, detail: "model_inference: next")
          ]
        ),
        bufferedEvents: [
          .init(name: .runStarted, detail: "Started running"),
          .init(name: .runFollowUpReady, detail: "model_inference: next")
        ]
      )
    )

    _ = try await runApp.run(arguments: ["run-goal", "Persist events"])

    let drainApp = PraxisCLIApp(
      configuration: configuration,
      runtimeInterface: StubRuntimeInterface(
        response: .success(
          snapshot: .init(kind: .inspection, title: "Unused", summary: "Unused")
        )
      )
    )

    let drainedOutput = try await drainApp.run(arguments: ["events", "--drain"])
    let emptyOutput = try await PraxisCLIApp(
      configuration: configuration,
      runtimeInterface: StubRuntimeInterface(
        response: .success(
          snapshot: .init(kind: .inspection, title: "Unused", summary: "Unused")
        )
      )
    ).run(arguments: ["events"])

    #expect(drainedOutput.contains("Drained events:"))
    #expect(drainedOutput.contains("run.started"))
    #expect(drainedOutput.contains("run.follow_up_ready"))
    #expect(emptyOutput == "No buffered events are available.")
  }
}
