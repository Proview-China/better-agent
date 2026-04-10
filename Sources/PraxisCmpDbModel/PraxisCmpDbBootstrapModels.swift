import PraxisCmpTypes

public enum PraxisCmpDbStatementPhase: String, Sendable, Codable {
  case bootstrap
  case read
  case write
}

public struct PraxisCmpDbStatement: Sendable, Equatable, Codable {
  public let statementID: String
  public let phase: PraxisCmpDbStatementPhase
  public let target: String
  public let sql: String

  public init(statementID: String, phase: PraxisCmpDbStatementPhase, target: String, sql: String) {
    self.statementID = statementID
    self.phase = phase
    self.target = target
    self.sql = sql
  }
}

public struct PraxisCmpDbBootstrapContract: Sendable, Equatable, Codable {
  public let projectID: String
  public let databaseName: String
  public let schemaName: String
  public let sharedTargets: [String]
  public let agentLocalTargets: [String]
  public let bootstrapStatements: [PraxisCmpDbStatement]
  public let readbackStatements: [PraxisCmpDbStatement]

  public init(
    projectID: String,
    databaseName: String,
    schemaName: String,
    sharedTargets: [String] = [],
    agentLocalTargets: [String] = [],
    bootstrapStatements: [PraxisCmpDbStatement],
    readbackStatements: [PraxisCmpDbStatement]
  ) {
    self.projectID = projectID
    self.databaseName = databaseName
    self.schemaName = schemaName
    self.sharedTargets = sharedTargets
    self.agentLocalTargets = agentLocalTargets
    self.bootstrapStatements = bootstrapStatements
    self.readbackStatements = readbackStatements
  }
}

public enum PraxisCmpDbReadbackStatus: String, Sendable, Codable {
  case present
  case missing
}

public struct PraxisCmpDbReadbackRecord: Sendable, Equatable, Codable {
  public let target: String
  public let status: PraxisCmpDbReadbackStatus
  public let tableReference: String?

  public init(target: String, status: PraxisCmpDbReadbackStatus, tableReference: String? = nil) {
    self.target = target
    self.status = status
    self.tableReference = tableReference
  }
}

public struct PraxisCmpDbBootstrapReceipt: Sendable, Equatable, Codable {
  public let contract: PraxisCmpDbBootstrapContract
  public let readbackRecords: [PraxisCmpDbReadbackRecord]
  public let missingTargetCount: Int

  public init(
    contract: PraxisCmpDbBootstrapContract,
    readbackRecords: [PraxisCmpDbReadbackRecord],
    missingTargetCount: Int
  ) {
    self.contract = contract
    self.readbackRecords = readbackRecords
    self.missingTargetCount = missingTargetCount
  }
}
