import PraxisCmpTypes
import PraxisCmpSections

public enum PraxisFiveAgentRole: String, Sendable, Codable {
  case icma
  case iterator
  case checker
  case dbAgent
  case dispatcher
}

public struct PraxisFiveAgentRoleDefinition: Sendable, Equatable, Codable {
  public let role: PraxisFiveAgentRole
  public let responsibility: String
  public let consumes: [String]
  public let produces: [String]
  public let nextRoles: [PraxisFiveAgentRole]

  public init(
    role: PraxisFiveAgentRole,
    responsibility: String,
    consumes: [String],
    produces: [String],
    nextRoles: [PraxisFiveAgentRole]
  ) {
    self.role = role
    self.responsibility = responsibility
    self.consumes = consumes
    self.produces = produces
    self.nextRoles = nextRoles
  }
}

public struct PraxisAgentHandOff: Sendable, Equatable, Codable {
  public let from: PraxisFiveAgentRole
  public let to: PraxisFiveAgentRole
  public let summary: String
  public let requiresCheckedSnapshot: Bool

  public init(
    from: PraxisFiveAgentRole,
    to: PraxisFiveAgentRole,
    summary: String,
    requiresCheckedSnapshot: Bool = false
  ) {
    self.from = from
    self.to = to
    self.summary = summary
    self.requiresCheckedSnapshot = requiresCheckedSnapshot
  }
}

public struct PraxisRoleAssignment: Sendable, Equatable, Codable {
  public let role: PraxisFiveAgentRole
  public let sectionIDs: [PraxisCmpSectionID]

  public init(role: PraxisFiveAgentRole, sectionIDs: [PraxisCmpSectionID]) {
    self.role = role
    self.sectionIDs = sectionIDs
  }
}

public struct PraxisFiveAgentProtocolDefinition: Sendable, Equatable, Codable {
  public let roles: [PraxisFiveAgentRoleDefinition]
  public let handOffRules: [PraxisAgentHandOff]

  public init(
    roles: [PraxisFiveAgentRoleDefinition],
    handOffRules: [PraxisAgentHandOff]
  ) {
    self.roles = roles
    self.handOffRules = handOffRules
  }
}
