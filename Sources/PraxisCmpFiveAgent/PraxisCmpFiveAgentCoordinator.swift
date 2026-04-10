public actor PraxisFiveAgentCoordinator {
  public private(set) var protocolDefinition: PraxisFiveAgentProtocolDefinition?
  public private(set) var assignments: [PraxisRoleAssignment]

  public init(protocolDefinition: PraxisFiveAgentProtocolDefinition? = nil) {
    self.protocolDefinition = protocolDefinition
    self.assignments = []
  }

  /// Replaces the current protocol definition.
  ///
  /// - Parameter protocolDefinition: Protocol definition that should become active.
  public func setProtocolDefinition(_ protocolDefinition: PraxisFiveAgentProtocolDefinition) {
    self.protocolDefinition = protocolDefinition
  }

  /// Stores a role assignment for later runtime inspection.
  ///
  /// - Parameter assignment: Assignment to store.
  public func assign(_ assignment: PraxisRoleAssignment) {
    assignments.removeAll { $0.role == assignment.role }
    assignments.append(assignment)
  }

  /// Validates a handoff against the active protocol definition.
  ///
  /// - Parameter handoff: Handoff that should be validated.
  /// - Returns: `true` when the handoff is part of the active protocol.
  public func accepts(_ handoff: PraxisAgentHandOff) -> Bool {
    protocolDefinition?.handOffRules.contains(handoff) == true
  }
}
