import Foundation
import PraxisRuntimeInterface

public struct PraxisCLIConfiguration: Sendable, Equatable, Codable {
  public let interactive: Bool
  public let stateRootDirectory: URL?

  public init(interactive: Bool, stateRootDirectory: URL? = nil) {
    self.interactive = interactive
    self.stateRootDirectory = stateRootDirectory
  }
}

public struct PraxisCLICommand: Sendable, Equatable, Codable {
  public let request: PraxisRuntimeInterfaceRequest

  public init(request: PraxisRuntimeInterfaceRequest) {
    self.request = request
  }
}

public enum PraxisCLIInvocation: Sendable, Equatable {
  case runtime(PraxisCLICommand)
  case events(drain: Bool)
  case help
}

public enum PraxisCLIError: Error, Sendable, Equatable, LocalizedError {
  case unknownCommand(String)
  case missingArgument(String)
  case invalidFlag(String)
  case unexpectedArguments(String)
  case interactiveModeUnsupported
  case runtimeFailure(PraxisRuntimeInterfaceErrorEnvelope?)

  public var errorDescription: String? {
    switch self {
    case .unknownCommand(let command):
      return "Unknown CLI command: \(command)"
    case .missingArgument(let command):
      return "Missing required argument for \(command)"
    case .invalidFlag(let flag):
      return "Unsupported CLI flag: \(flag)"
    case .unexpectedArguments(let command):
      return "Unexpected extra arguments for \(command)"
    case .interactiveModeUnsupported:
      return "Interactive mode is not supported in this CLI build. Use an explicit command instead."
    case .runtimeFailure(let envelope):
      guard let envelope else {
        return "Runtime request failed without an error envelope."
      }
      return "Error [\(envelope.code.rawValue)]: \(envelope.message)"
    }
  }
}
