import Testing
@testable import PraxisCLI
import PraxisRuntimeInterface
import Foundation

private final class StubRuntimeInterface: @unchecked Sendable, PraxisRuntimeInterfaceServing {
  let bootstrap: PraxisRuntimeInterfaceSnapshot
  let response: PraxisRuntimeInterfaceResponse
  let bufferedEvents: [PraxisRuntimeInterfaceEvent]
  private(set) var handledRequests: [PraxisRuntimeInterfaceRequest] = []

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
    handledRequests.append(request)
    return response
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
    #expect(throws: PraxisCLIError.invalidFlag("--flag")) {
      try parser.parse(["run-goal", "--flag"])
    }
    #expect(throws: PraxisCLIError.invalidFlag("--flag")) {
      try parser.parse(["resume-run", "--flag"])
    }
    #expect(renderer.renderHelp().contains("run-goal <summary>"))
  }

  @Test
  func runGoalParserAllowsFreeformSummaryContainingFlagLikeTokens() throws {
    let parser = PraxisCLICommandParser()
    let invocation = try parser.parse(["run-goal", "fix", "parser", "--", "preserve", "empty", "state"])

    switch invocation {
    case .runtime(let command):
      guard case .runGoal(let payload) = command.request else {
        Issue.record("Expected run-goal parse to produce a runGoal request.")
        return
      }
      #expect(payload.payloadSummary == "fix parser -- preserve empty state")
    default:
      Issue.record("Expected run-goal parse to produce a runtime invocation.")
    }
  }

  @Test
  func resumeRunParserRequiresSingleStrictPositionalArgument() throws {
    let parser = PraxisCLICommandParser()
    let invocation = try parser.parse(["resume-run", "run:123"])

    switch invocation {
    case .runtime(let command):
      guard case .resumeRun(let payload) = command.request else {
        Issue.record("Expected resume-run parse to produce a resumeRun request.")
        return
      }
      #expect(payload.runID == "run:123")
      #expect(payload.payloadSummary == "run:123")
    default:
      Issue.record("Expected resume-run parse to produce a runtime invocation.")
    }

    #expect(throws: PraxisCLIError.invalidFlag("--latest")) {
      try parser.parse(["resume-run", "--latest"])
    }
    #expect(throws: PraxisCLIError.unexpectedArguments("resume-run")) {
      try parser.parse(["resume-run", "run:123", "extra-token"])
    }
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

  @Test
  func cliAppRejectsUnknownCommandsWithStableUserFacingMessage() async throws {
    let runtimeInterface = StubRuntimeInterface(
      response: .success(
        snapshot: .init(kind: .inspection, title: "Unused", summary: "Unused")
      )
    )
    let app = PraxisCLIApp(
      configuration: .init(interactive: false),
      runtimeInterface: runtimeInterface
    )

    do {
      _ = try await app.run(arguments: ["unknown-command"])
      Issue.record("Expected invalid CLI command to throw.")
    } catch let error as PraxisCLIError {
      #expect(error == .unknownCommand("unknown-command"))
      #expect(error.errorDescription == "Unknown CLI command: unknown-command")
    }

    #expect(runtimeInterface.handledRequests.isEmpty)
  }

  @Test
  func cliAppRejectsInvalidRunGoalAndResumeRunArgumentsWithStableMessages() async throws {
    let runtimeInterface = StubRuntimeInterface(
      response: .success(
        snapshot: .init(kind: .inspection, title: "Unused", summary: "Unused")
      )
    )
    let app = PraxisCLIApp(
      configuration: .init(interactive: false),
      runtimeInterface: runtimeInterface
    )

    do {
      _ = try await app.run(arguments: ["run-goal", "--dry-run"])
      Issue.record("Expected run-goal flag validation to throw.")
    } catch let error as PraxisCLIError {
      #expect(error == .invalidFlag("--dry-run"))
      #expect(error.errorDescription == "Unsupported CLI flag: --dry-run")
    }

    do {
      _ = try await app.run(arguments: ["resume-run", "--latest"])
      Issue.record("Expected resume-run flag validation to throw.")
    } catch let error as PraxisCLIError {
      #expect(error == .invalidFlag("--latest"))
      #expect(error.errorDescription == "Unsupported CLI flag: --latest")
    }

    do {
      _ = try await app.run(arguments: ["resume-run", "run:123", "extra-token"])
      Issue.record("Expected resume-run extra positional validation to throw.")
    } catch let error as PraxisCLIError {
      #expect(error == .unexpectedArguments("resume-run"))
      #expect(error.errorDescription == "Unexpected extra arguments for resume-run")
    }

    #expect(runtimeInterface.handledRequests.isEmpty)
  }

  @Test
  func cliAppAllowsRunGoalSummaryContainingFlagLikeTokens() async throws {
    let runtimeInterface = StubRuntimeInterface(
      response: .success(
        snapshot: .init(
          kind: .run,
          title: "Run run:session.cli.test:cli.goal.test",
          summary: "Started running"
        )
      )
    )
    let app = PraxisCLIApp(
      configuration: .init(interactive: false),
      runtimeInterface: runtimeInterface
    )

    _ = try await app.run(arguments: ["run-goal", "fix", "parser", "--", "preserve", "empty", "state"])

    #expect(runtimeInterface.handledRequests.count == 1)
    guard case .runGoal(let payload) = runtimeInterface.handledRequests.first else {
      Issue.record("Expected run-goal invocation to reach runtime interface.")
      return
    }
    #expect(payload.payloadSummary == "fix parser -- preserve empty state")
  }

  @Test
  func cliAppFailsFastWhenInteractiveModeIsRequested() async throws {
    let runtimeInterface = StubRuntimeInterface(
      response: .success(
        snapshot: .init(kind: .inspection, title: "Unused", summary: "Unused")
      )
    )
    let app = PraxisCLIApp(
      configuration: .init(interactive: true),
      runtimeInterface: runtimeInterface
    )

    do {
      _ = try await app.run(arguments: ["inspect-architecture"])
      Issue.record("Expected interactive mode to fail fast.")
    } catch let error as PraxisCLIError {
      #expect(error == .interactiveModeUnsupported)
      #expect(
        error.errorDescription
          == "Interactive mode is not supported in this CLI build. Use an explicit command instead."
      )
    }

    #expect(runtimeInterface.handledRequests.isEmpty)
  }
}
