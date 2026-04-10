import PraxisRun

public protocol PraxisRunGoalUseCaseProtocol: Sendable {
  func execute(_ command: PraxisRunGoalCommand) async throws -> PraxisRunID
}

public protocol PraxisResumeRunUseCaseProtocol: Sendable {
  func execute(_ command: PraxisResumeRunCommand) async throws -> PraxisRunID
}

public protocol PraxisInspectTapUseCaseProtocol: Sendable {
  func execute() async throws -> PraxisTapInspection
}

public protocol PraxisInspectCmpUseCaseProtocol: Sendable {
  func execute() async throws -> PraxisCmpInspection
}

public protocol PraxisInspectMpUseCaseProtocol: Sendable {
  func execute() async throws -> PraxisMpInspection
}

public protocol PraxisBuildCapabilityCatalogUseCaseProtocol: Sendable {
  func execute() async throws -> String
}
