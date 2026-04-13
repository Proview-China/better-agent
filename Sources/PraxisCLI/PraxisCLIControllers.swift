import Foundation
import PraxisRuntimeGateway
import PraxisRuntimeInterface

private struct PraxisCLIStatePaths: Sendable {
  let rootDirectory: URL
  let eventsFileURL: URL

  init(rootDirectory: URL) {
    self.rootDirectory = rootDirectory
    self.eventsFileURL = rootDirectory.appendingPathComponent("cli-events.json", isDirectory: false)
  }

  static func resolveRootDirectory(_ explicitRootDirectory: URL?) -> URL {
    if let explicitRootDirectory {
      return explicitRootDirectory
    }

    if let configuredRoot = ProcessInfo.processInfo.environment["PRAXIS_LOCAL_RUNTIME_ROOT"],
       !configuredRoot.isEmpty {
      return URL(fileURLWithPath: configuredRoot, isDirectory: true)
    }

    return FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-local-runtime", isDirectory: true)
  }
}

private enum PraxisCLIJSONFileIO {
  static func load<Value: Decodable>(_ type: Value.Type, from fileURL: URL) throws -> Value? {
    guard FileManager.default.fileExists(atPath: fileURL.path) else {
      return nil
    }
    let data = try Data(contentsOf: fileURL)
    return try JSONDecoder().decode(type, from: data)
  }

  static func save<Value: Encodable>(_ value: Value, to fileURL: URL) throws {
    try FileManager.default.createDirectory(
      at: fileURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(value).write(to: fileURL, options: .atomic)
  }
}

public actor PraxisCLIEventStore {
  private let fileURL: URL
  private var didLoad = false
  private var events: [PraxisRuntimeInterfaceEvent]

  public init(fileURL: URL, seedEvents: [PraxisRuntimeInterfaceEvent] = []) {
    self.fileURL = fileURL
    self.events = seedEvents
  }

  public func append(contentsOf newEvents: [PraxisRuntimeInterfaceEvent]) async throws {
    guard !newEvents.isEmpty else {
      return
    }
    try loadIfNeeded()
    events.append(contentsOf: newEvents)
    try persist()
  }

  public func snapshot() async throws -> [PraxisRuntimeInterfaceEvent] {
    try loadIfNeeded()
    return events
  }

  public func drain() async throws -> [PraxisRuntimeInterfaceEvent] {
    try loadIfNeeded()
    let snapshot = events
    events = []
    try persist()
    return snapshot
  }

  private func loadIfNeeded() throws {
    guard !didLoad else {
      return
    }
    events = try PraxisCLIJSONFileIO.load([PraxisRuntimeInterfaceEvent].self, from: fileURL) ?? events
    didLoad = true
  }

  private func persist() throws {
    try PraxisCLIJSONFileIO.save(events, to: fileURL)
  }
}

public final class PraxisCLIApp {
  public let configuration: PraxisCLIConfiguration
  public let runtimeInterface: any PraxisRuntimeInterfaceServing
  public let commandRouter: PraxisCLICommandRouter
  public let commandParser: PraxisCLICommandParser
  public let terminalRenderer: PraxisTerminalRenderer
  public let eventStore: PraxisCLIEventStore

  public init(
    configuration: PraxisCLIConfiguration,
    runtimeInterface: any PraxisRuntimeInterfaceServing,
    commandParser: PraxisCLICommandParser = .init(),
    terminalRenderer: PraxisTerminalRenderer = .init(),
    eventStore: PraxisCLIEventStore? = nil
  ) {
    self.configuration = configuration
    self.runtimeInterface = runtimeInterface
    self.commandRouter = PraxisCLICommandRouter(runtimeInterface: runtimeInterface)
    self.commandParser = commandParser
    self.terminalRenderer = terminalRenderer
    let paths = PraxisCLIStatePaths(
      rootDirectory: PraxisCLIStatePaths.resolveRootDirectory(configuration.stateRootDirectory)
    )
    self.eventStore = eventStore ?? PraxisCLIEventStore(fileURL: paths.eventsFileURL)
  }

  public convenience init(
    configuration: PraxisCLIConfiguration
  ) throws {
    try self.init(
      configuration: configuration,
      runtimeInterface: PraxisRuntimeGatewayFactory.makeRuntimeInterface()
    )
  }

  public func bootstrapSnapshot() -> PraxisRuntimeInterfaceSnapshot {
    runtimeInterface.bootstrapSnapshot()
  }

  public func run(arguments: [String]) async throws -> String {
    try validateConfiguration()
    let invocation = try commandParser.parse(arguments)

    switch invocation {
    case .runtime(let command):
      let response = await commandRouter.route(command)
      let bufferedEvents = await runtimeInterface.drainEvents()
      let persistedEvents = bufferedEvents.isEmpty ? response.events : bufferedEvents
      try await eventStore.append(contentsOf: persistedEvents)

      guard response.isSuccess else {
        throw PraxisCLIError.runtimeFailure(response.error)
      }

      return terminalRenderer.render(response)
    case .events(let drain):
      let events = drain ? try await eventStore.drain() : try await eventStore.snapshot()
      return terminalRenderer.render(events: events, drained: drain)
    case .help:
      return terminalRenderer.renderHelp()
    }
  }

  private func validateConfiguration() throws {
    guard !configuration.interactive else {
      throw PraxisCLIError.interactiveModeUnsupported
    }
  }
}

public final class PraxisCLICommandRouter {
  public let runtimeInterface: any PraxisRuntimeInterfaceServing

  public init(runtimeInterface: any PraxisRuntimeInterfaceServing) {
    self.runtimeInterface = runtimeInterface
  }

  public convenience init() throws {
    try self.init(runtimeInterface: PraxisRuntimeGatewayFactory.makeRuntimeInterface())
  }

  public func route(_ command: PraxisCLICommand) async -> PraxisRuntimeInterfaceResponse {
    await runtimeInterface.handle(command.request)
  }
}

public actor PraxisInteractiveSessionController {
  public private(set) var history: [PraxisCLICommand]

  public init(history: [PraxisCLICommand] = []) {
    self.history = history
  }

  public func append(_ command: PraxisCLICommand) {
    history.append(command)
  }
}

public struct PraxisCLICommandParser: Sendable {
  public init() {}

  public func parse(_ arguments: [String]) throws -> PraxisCLIInvocation {
    guard let firstArgument = arguments.first else {
      return .runtime(.init(request: .inspectArchitecture))
    }

    switch firstArgument {
    case "help", "--help", "-h":
      return .help
    case "inspect-architecture":
      return .runtime(.init(request: .inspectArchitecture))
    case "inspect-tap":
      return .runtime(.init(request: .inspectTap))
    case "inspect-cmp":
      return .runtime(.init(request: .inspectCmp))
    case "inspect-mp":
      return .runtime(.init(request: .inspectMp))
    case "run-goal":
      let payloadSummary = try parseRequiredPositionalArgument(
        command: "run-goal",
        arguments: arguments.dropFirst()
      )
      let invocationToken = UUID().uuidString.lowercased()
      return .runtime(
        .init(
          request: .runGoal(
            .init(
              payloadSummary: payloadSummary,
              goalID: "cli.goal.\(invocationToken)",
              goalTitle: "CLI requested goal",
              sessionID: "session.cli.\(invocationToken)"
            )
          )
        )
      )
    case "resume-run":
      let runID = try parseRequiredPositionalArgument(
        command: "resume-run",
        arguments: arguments.dropFirst()
      )
      return .runtime(
        .init(
          request: .resumeRun(
            .init(
              payloadSummary: runID,
              runID: runID
            )
          )
        )
      )
    case "events":
      let flags = Array(arguments.dropFirst())
      guard flags.allSatisfy({ $0 == "--drain" }) else {
        let invalidFlag = flags.first { $0 != "--drain" } ?? ""
        throw PraxisCLIError.invalidFlag(invalidFlag)
      }
      return .events(drain: flags.contains("--drain"))
    default:
      throw PraxisCLIError.unknownCommand(firstArgument)
    }
  }

  private func parseRequiredPositionalArgument(
    command: String,
    arguments: ArraySlice<String>
  ) throws -> String {
    guard !arguments.isEmpty else {
      throw PraxisCLIError.missingArgument(command)
    }

    if let invalidFlag = arguments.first(where: { $0.hasPrefix("--") }) {
      throw PraxisCLIError.invalidFlag(invalidFlag)
    }

    let joined = arguments
      .joined(separator: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !joined.isEmpty else {
      throw PraxisCLIError.missingArgument(command)
    }
    return joined
  }
}

public final class PraxisTerminalRenderer {
  public init() {}

  public func render(_ response: PraxisRuntimeInterfaceResponse) -> String {
    guard response.isSuccess else {
      return render(error: response.error)
    }

    guard let snapshot = response.snapshot else {
      return "Runtime response succeeded without a snapshot."
    }

    return render(snapshot: snapshot, events: response.events)
  }

  public func render(
    snapshot: PraxisRuntimeInterfaceSnapshot,
    events: [PraxisRuntimeInterfaceEvent] = []
  ) -> String {
    var lines = [
      snapshot.title,
      snapshot.summary,
    ]

    if let pendingIntentID = snapshot.pendingIntentID {
      lines.append("Pending intent: \(pendingIntentID)")
    }

    if !events.isEmpty {
      lines.append("Events:")
      lines.append(contentsOf: events.map { "- \($0.name): \($0.detail)" })
    }

    return lines.joined(separator: "\n")
  }

  public func render(events: [PraxisRuntimeInterfaceEvent], drained: Bool) -> String {
    guard !events.isEmpty else {
      return drained ? "No buffered events were drained." : "No buffered events are available."
    }

    let header = drained ? "Drained events:" : "Buffered events:"
    let body = events.map { event in
      if let runID = event.runID {
        return "- \(event.name) [\(runID.rawValue)]: \(event.detail)"
      }
      return "- \(event.name): \(event.detail)"
    }
    return ([header] + body).joined(separator: "\n")
  }

  public func render(error: PraxisRuntimeInterfaceErrorEnvelope?) -> String {
    guard let error else {
      return "Runtime request failed without an error envelope."
    }

    return "Error [\(error.code.rawValue)]: \(error.message)"
  }

  public func renderHelp() -> String {
    [
      "Praxis CLI",
      "Commands:",
      "- inspect-architecture",
      "- inspect-tap",
      "- inspect-cmp",
      "- inspect-mp",
      "- run-goal <summary>",
      "- resume-run <run-id>",
      "- events [--drain]",
      "- help",
    ].joined(separator: "\n")
  }
}
