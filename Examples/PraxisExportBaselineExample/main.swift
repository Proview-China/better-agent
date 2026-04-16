import Foundation
import PraxisFFI
import PraxisRuntimeInterface

#if canImport(Darwin)
import Darwin
#endif

private enum PraxisExportBaselineError: Error, LocalizedError {
  case invalidArguments(String)
  case unexpectedResponse(String)

  var errorDescription: String? {
    switch self {
    case .invalidArguments(let message):
      return message
    case .unexpectedResponse(let message):
      return message
    }
  }
}

private enum PraxisExportBaselineFormat: String {
  case text
  case json
}

private struct PraxisExportBaselineArguments {
  let iterations: Int
  let format: PraxisExportBaselineFormat
  let rootDirectory: URL

  static func parse(_ arguments: [String]) throws -> PraxisExportBaselineArguments {
    var iterations = 5
    var format: PraxisExportBaselineFormat = .text
    var rootDirectoryPath: String?

    var index = 0
    while index < arguments.count {
      switch arguments[index] {
      case "--iterations":
        index += 1
        guard index < arguments.count, let parsedIterations = Int(arguments[index]), parsedIterations > 0 else {
          throw PraxisExportBaselineError.invalidArguments("Expected a positive integer after --iterations.")
        }
        iterations = parsedIterations
      case "--format":
        index += 1
        guard index < arguments.count, let parsedFormat = PraxisExportBaselineFormat(rawValue: arguments[index]) else {
          throw PraxisExportBaselineError.invalidArguments("Expected --format text|json.")
        }
        format = parsedFormat
      case "--root":
        index += 1
        guard index < arguments.count else {
          throw PraxisExportBaselineError.invalidArguments("Expected a path after --root.")
        }
        rootDirectoryPath = arguments[index]
      case "--help", "-h":
        throw PraxisExportBaselineError.invalidArguments(
          "Usage: swift run PraxisExportBaselineExample [--iterations 5] [--format text|json] [--root /tmp/praxis-export-baseline]"
        )
      default:
        throw PraxisExportBaselineError.invalidArguments("Unknown argument '\(arguments[index])'.")
      }
      index += 1
    }

    let rootDirectory: URL
    if let rootDirectoryPath {
      rootDirectory = URL(fileURLWithPath: rootDirectoryPath, isDirectory: true)
    } else {
      rootDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("praxis-export-baseline", isDirectory: true)
        .appendingPathComponent(UUID().uuidString.lowercased(), isDirectory: true)
    }

    return PraxisExportBaselineArguments(
      iterations: iterations,
      format: format,
      rootDirectory: rootDirectory
    )
  }
}

private struct PraxisExportBaselineNumericSummary: Encodable {
  let count: Int
  let min: Double
  let average: Double
  let max: Double
}

private struct PraxisExportBaselineIntegerSummary: Encodable {
  let count: Int
  let min: Int
  let average: Double
  let max: Int
}

private struct PraxisExportBaselineCompatibility: Encodable, Equatable {
  let requestSchemaVersion: String
  let responseSchemaVersion: String
  let eventSchemaVersion: String
  let supportedRequestSchemaVersion: String
  let supportedResponseSchemaVersion: String
  let supportedEventSchemaVersion: String
  let acceptsLegacyVersionlessPayloads: Bool
}

private struct PraxisExportBaselineResidentMemory: Encodable {
  let beforeBytes: UInt64?
  let peakBytes: UInt64?
  let afterBytes: UInt64?
}

private struct PraxisExportBaselineReport: Encodable {
  let recordedAt: String
  let platform: String
  let rootDirectory: String
  let iterations: Int
  let totalDurationMilliseconds: Double
  let sessionOpenMilliseconds: PraxisExportBaselineNumericSummary
  let architectureRoundTripMilliseconds: PraxisExportBaselineNumericSummary
  let architectureDrainMilliseconds: PraxisExportBaselineNumericSummary
  let runRoundTripMilliseconds: PraxisExportBaselineNumericSummary
  let runDrainMilliseconds: PraxisExportBaselineNumericSummary
  let architectureRequestBytes: PraxisExportBaselineIntegerSummary
  let architectureResponseBytes: PraxisExportBaselineIntegerSummary
  let architectureEventEnvelopeBytes: PraxisExportBaselineIntegerSummary
  let architectureEventCounts: PraxisExportBaselineIntegerSummary
  let runRequestBytes: PraxisExportBaselineIntegerSummary
  let runResponseBytes: PraxisExportBaselineIntegerSummary
  let runEventEnvelopeBytes: PraxisExportBaselineIntegerSummary
  let runEventCounts: PraxisExportBaselineIntegerSummary
  let residentMemory: PraxisExportBaselineResidentMemory
  let compatibility: PraxisExportBaselineCompatibility
}

private struct PraxisExportBaselineIteration {
  let sessionOpenMilliseconds: Double
  let architectureRoundTripMilliseconds: Double
  let architectureDrainMilliseconds: Double
  let runRoundTripMilliseconds: Double
  let runDrainMilliseconds: Double
  let architectureRequestBytes: Int
  let architectureResponseBytes: Int
  let architectureEventEnvelopeBytes: Int
  let architectureEventCount: Int
  let runRequestBytes: Int
  let runResponseBytes: Int
  let runEventEnvelopeBytes: Int
  let runEventCount: Int
  let compatibility: PraxisExportBaselineCompatibility
}

private enum PraxisExportBaselineRunner {
  static func collect(
    iterations: Int,
    rootDirectory: URL
  ) async throws -> PraxisExportBaselineReport {
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let bridge = PraxisFFIFactory.makeFFIBridge(rootDirectory: rootDirectory)
    let codec = PraxisJSONRuntimeInterfaceCodec()
    let decoder = JSONDecoder()

    var collectedIterations: [PraxisExportBaselineIteration] = []
    var negotiatedCompatibility: PraxisExportBaselineCompatibility?
    let startingResidentMemory = currentResidentMemoryBytes()
    var peakResidentMemory = startingResidentMemory
    let totalClockStart = ContinuousClock.now

    for iteration in 0..<iterations {
      let (handle, sessionOpenMilliseconds) = try await measureAsync {
        try await bridge.openRuntimeSession()
      }

      do {
        let architectureRequest = PraxisRuntimeInterfaceRequest.inspectArchitecture
        let architectureRequestData = try codec.encode(architectureRequest)
        let (architectureResponseData, architectureRoundTripMilliseconds) = try await measureAsync {
          try await bridge.handleEncodedRequest(architectureRequestData, on: handle)
        }
        let architectureResponse = try codec.decodeResponse(architectureResponseData)
        guard architectureResponse.status == .success, let architectureSnapshot = architectureResponse.snapshot else {
          throw PraxisExportBaselineError.unexpectedResponse(
            "Architecture inspection failed during iteration \(iteration + 1)."
          )
        }
        let (architectureEventEnvelopeData, architectureDrainMilliseconds) = try await measureAsync {
          try await bridge.drainEncodedEvents(for: handle)
        }
        let architectureEventEnvelope = try decoder.decode(
          PraxisFFIEventEnvelope.self,
          from: architectureEventEnvelopeData
        )
        guard architectureEventEnvelope.status == .success else {
          throw PraxisExportBaselineError.unexpectedResponse(
            "Architecture event drain failed during iteration \(iteration + 1)."
          )
        }

        let compatibility = try makeCompatibilityBaseline(
          request: architectureRequest,
          response: architectureResponse,
          eventEnvelope: architectureEventEnvelope,
          snapshot: architectureSnapshot
        )

        if let negotiatedCompatibility, negotiatedCompatibility != compatibility {
          throw PraxisExportBaselineError.unexpectedResponse(
            "Architecture negotiation changed across iterations."
          )
        }
        negotiatedCompatibility = compatibility

        let runRequest = PraxisRuntimeInterfaceRequest.runGoal(
          .init(
            payloadSummary: "Collect export baseline iteration \(iteration + 1)",
            goalID: "goal.export-baseline.\(iteration + 1)",
            goalTitle: "Export Baseline Goal \(iteration + 1)",
            sessionID: "session.export-baseline.\(iteration + 1)"
          )
        )
        let runRequestData = try codec.encode(runRequest)
        let (runResponseData, runRoundTripMilliseconds) = try await measureAsync {
          try await bridge.handleEncodedRequest(runRequestData, on: handle)
        }
        let runResponse = try codec.decodeResponse(runResponseData)
        guard runResponse.status == .success else {
          throw PraxisExportBaselineError.unexpectedResponse(
            "Run request failed during iteration \(iteration + 1): \(runResponse.error?.message ?? "unknown failure")."
          )
        }
        let (runEventEnvelopeData, runDrainMilliseconds) = try await measureAsync {
          try await bridge.drainEncodedEvents(for: handle)
        }
        let runEventEnvelope = try decoder.decode(PraxisFFIEventEnvelope.self, from: runEventEnvelopeData)
        guard runEventEnvelope.status == .success else {
          throw PraxisExportBaselineError.unexpectedResponse(
            "Run event drain failed during iteration \(iteration + 1)."
          )
        }

        collectedIterations.append(
          .init(
            sessionOpenMilliseconds: sessionOpenMilliseconds,
            architectureRoundTripMilliseconds: architectureRoundTripMilliseconds,
            architectureDrainMilliseconds: architectureDrainMilliseconds,
            runRoundTripMilliseconds: runRoundTripMilliseconds,
            runDrainMilliseconds: runDrainMilliseconds,
            architectureRequestBytes: architectureRequestData.count,
            architectureResponseBytes: architectureResponseData.count,
            architectureEventEnvelopeBytes: architectureEventEnvelopeData.count,
            architectureEventCount: architectureEventEnvelope.events.count,
            runRequestBytes: runRequestData.count,
            runResponseBytes: runResponseData.count,
            runEventEnvelopeBytes: runEventEnvelopeData.count,
            runEventCount: runEventEnvelope.events.count,
            compatibility: compatibility
          )
        )

        if let currentResidentMemory = currentResidentMemoryBytes() {
          peakResidentMemory = max(peakResidentMemory ?? currentResidentMemory, currentResidentMemory)
        }
        _ = await bridge.closeRuntimeSession(handle)
      } catch {
        _ = await bridge.closeRuntimeSession(handle)
        throw error
      }
    }

    let totalDurationMilliseconds = milliseconds(since: totalClockStart)
    let endingResidentMemory = currentResidentMemoryBytes()
    let compatibility = try requireValue(
      negotiatedCompatibility,
      message: "Expected to collect at least one compatibility baseline sample."
    )

    return PraxisExportBaselineReport(
      recordedAt: ISO8601DateFormatter().string(from: Date()),
      platform: currentPlatformDescription(),
      rootDirectory: rootDirectory.path,
      iterations: iterations,
      totalDurationMilliseconds: totalDurationMilliseconds,
      sessionOpenMilliseconds: summarize(collectedIterations.map(\.sessionOpenMilliseconds)),
      architectureRoundTripMilliseconds: summarize(collectedIterations.map(\.architectureRoundTripMilliseconds)),
      architectureDrainMilliseconds: summarize(collectedIterations.map(\.architectureDrainMilliseconds)),
      runRoundTripMilliseconds: summarize(collectedIterations.map(\.runRoundTripMilliseconds)),
      runDrainMilliseconds: summarize(collectedIterations.map(\.runDrainMilliseconds)),
      architectureRequestBytes: summarize(collectedIterations.map(\.architectureRequestBytes)),
      architectureResponseBytes: summarize(collectedIterations.map(\.architectureResponseBytes)),
      architectureEventEnvelopeBytes: summarize(collectedIterations.map(\.architectureEventEnvelopeBytes)),
      architectureEventCounts: summarize(collectedIterations.map(\.architectureEventCount)),
      runRequestBytes: summarize(collectedIterations.map(\.runRequestBytes)),
      runResponseBytes: summarize(collectedIterations.map(\.runResponseBytes)),
      runEventEnvelopeBytes: summarize(collectedIterations.map(\.runEventEnvelopeBytes)),
      runEventCounts: summarize(collectedIterations.map(\.runEventCount)),
      residentMemory: .init(
        beforeBytes: startingResidentMemory,
        peakBytes: peakResidentMemory,
        afterBytes: endingResidentMemory
      ),
      compatibility: compatibility
    )
  }
}

@main
struct PraxisExportBaselineExample {
  static func main() async throws {
    let arguments = try PraxisExportBaselineArguments.parse(Array(CommandLine.arguments.dropFirst()))
    let report = try await PraxisExportBaselineRunner.collect(
      iterations: arguments.iterations,
      rootDirectory: arguments.rootDirectory
    )

    switch arguments.format {
    case .json:
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
      print(String(decoding: try encoder.encode(report), as: UTF8.self))
    case .text:
      renderTextReport(report)
    }
  }
}

private func renderTextReport(_ report: PraxisExportBaselineReport) {
  print("Praxis Export Baseline Example")
  print("recordedAt: \(report.recordedAt)")
  print("platform: \(report.platform)")
  print("rootDirectory: \(report.rootDirectory)")
  print("iterations: \(report.iterations)")
  print("totalDurationMilliseconds: \(format(report.totalDurationMilliseconds))")
  print("compatibility.requestSchemaVersion: \(report.compatibility.requestSchemaVersion)")
  print("compatibility.responseSchemaVersion: \(report.compatibility.responseSchemaVersion)")
  print("compatibility.eventSchemaVersion: \(report.compatibility.eventSchemaVersion)")
  print("compatibility.supportedRequestSchemaVersion: \(report.compatibility.supportedRequestSchemaVersion)")
  print("compatibility.supportedResponseSchemaVersion: \(report.compatibility.supportedResponseSchemaVersion)")
  print("compatibility.supportedEventSchemaVersion: \(report.compatibility.supportedEventSchemaVersion)")
  print("compatibility.acceptsLegacyVersionlessPayloads: \(report.compatibility.acceptsLegacyVersionlessPayloads)")
  print("sessionOpen.avgMs: \(format(report.sessionOpenMilliseconds.average))")
  print("architecture.roundTrip.avgMs: \(format(report.architectureRoundTripMilliseconds.average))")
  print("architecture.drain.avgMs: \(format(report.architectureDrainMilliseconds.average))")
  print("run.roundTrip.avgMs: \(format(report.runRoundTripMilliseconds.average))")
  print("run.drain.avgMs: \(format(report.runDrainMilliseconds.average))")
  print("architecture.request.avgBytes: \(format(report.architectureRequestBytes.average))")
  print("architecture.response.avgBytes: \(format(report.architectureResponseBytes.average))")
  print("run.request.avgBytes: \(format(report.runRequestBytes.average))")
  print("run.response.avgBytes: \(format(report.runResponseBytes.average))")
  print("run.events.avgCount: \(format(report.runEventCounts.average))")
  print("residentMemory.beforeBytes: \(report.residentMemory.beforeBytes.map(String.init) ?? "unavailable")")
  print("residentMemory.peakBytes: \(report.residentMemory.peakBytes.map(String.init) ?? "unavailable")")
  print("residentMemory.afterBytes: \(report.residentMemory.afterBytes.map(String.init) ?? "unavailable")")
}

private func makeCompatibilityBaseline(
  request: PraxisRuntimeInterfaceRequest,
  response: PraxisRuntimeInterfaceResponse,
  eventEnvelope: PraxisFFIEventEnvelope,
  snapshot: PraxisRuntimeInterfaceSnapshot
) throws -> PraxisExportBaselineCompatibility {
  let supportedRequestSchemaVersion = try requireValue(
    snapshot.supportedRequestSchemaVersion,
    message: "Architecture snapshot did not publish supportedRequestSchemaVersion."
  )
  let supportedResponseSchemaVersion = try requireValue(
    snapshot.supportedResponseSchemaVersion,
    message: "Architecture snapshot did not publish supportedResponseSchemaVersion."
  )
  let supportedEventSchemaVersion = try requireValue(
    snapshot.supportedEventSchemaVersion,
    message: "Architecture snapshot did not publish supportedEventSchemaVersion."
  )

  return .init(
    requestSchemaVersion: request.requestSchemaVersion.rawValue,
    responseSchemaVersion: response.responseSchemaVersion.rawValue,
    eventSchemaVersion: eventEnvelope.eventSchemaVersion.rawValue,
    supportedRequestSchemaVersion: supportedRequestSchemaVersion.rawValue,
    supportedResponseSchemaVersion: supportedResponseSchemaVersion.rawValue,
    supportedEventSchemaVersion: supportedEventSchemaVersion.rawValue,
    acceptsLegacyVersionlessPayloads: snapshot.acceptsLegacyVersionlessPayloads ?? false
  )
}

private func summarize(_ values: [Double]) -> PraxisExportBaselineNumericSummary {
  let minimum = values.min() ?? .zero
  let maximum = values.max() ?? .zero
  let average = values.isEmpty ? .zero : values.reduce(.zero, +) / Double(values.count)
  return .init(count: values.count, min: minimum, average: average, max: maximum)
}

private func summarize(_ values: [Int]) -> PraxisExportBaselineIntegerSummary {
  let minimum = values.min() ?? .zero
  let maximum = values.max() ?? .zero
  let average = values.isEmpty ? .zero : Double(values.reduce(.zero, +)) / Double(values.count)
  return .init(count: values.count, min: minimum, average: average, max: maximum)
}

private func measureAsync<T>(
  _ operation: () async throws -> T
) async rethrows -> (T, Double) {
  let start = ContinuousClock.now
  let value = try await operation()
  return (value, milliseconds(since: start))
}

private func milliseconds(since start: ContinuousClock.Instant) -> Double {
  let duration = start.duration(to: .now)
  return Double(duration.components.seconds) * 1_000
    + Double(duration.components.attoseconds) / 1_000_000_000_000_000
}

private func requireValue<T>(_ value: T?, message: String) throws -> T {
  guard let value else {
    throw PraxisExportBaselineError.unexpectedResponse(message)
  }
  return value
}

private func format(_ value: Double) -> String {
  String(format: "%.3f", value)
}

private func currentPlatformDescription() -> String {
  #if os(macOS)
  return "macOS"
  #elseif os(iOS)
  return "iOS"
  #elseif os(tvOS)
  return "tvOS"
  #elseif os(watchOS)
  return "watchOS"
  #elseif os(visionOS)
  return "visionOS"
  #elseif os(Linux)
  return "Linux"
  #else
  return "unknown"
  #endif
}

private func currentResidentMemoryBytes() -> UInt64? {
  #if canImport(Darwin)
  var info = mach_task_basic_info()
  var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size / MemoryLayout<natural_t>.size)
  let status: kern_return_t = withUnsafeMutablePointer(to: &info) { pointer in
    pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { rebound in
      task_info(
        mach_task_self_,
        task_flavor_t(MACH_TASK_BASIC_INFO),
        rebound,
        &count
      )
    }
  }
  guard status == KERN_SUCCESS else {
    return nil
  }
  return UInt64(info.resident_size)
  #else
  return nil
  #endif
}
