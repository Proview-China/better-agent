import PraxisCoreTypes

public enum PraxisMpScopeLevel: String, Sendable, Equatable, Codable, CaseIterable {
  case global
  case project
  case agentIsolated = "agent_isolated"
}

public enum PraxisMpSessionMode: String, Sendable, Equatable, Codable, CaseIterable {
  case isolated
  case bridged
  case shared
}

public enum PraxisMpVisibilityState: String, Sendable, Equatable, Codable, CaseIterable {
  case localOnly = "local_only"
  case sessionBridged = "session_bridged"
  case projectShared = "project_shared"
  case globalShared = "global_shared"
  case archived
}

public enum PraxisMpPromotionState: String, Sendable, Equatable, Codable, CaseIterable {
  case localOnly = "local_only"
  case submittedToParent = "submitted_to_parent"
  case acceptedByParent = "accepted_by_parent"
  case promotedToProject = "promoted_to_project"
  case promotedToGlobal = "promoted_to_global"
  case archived
}

public struct PraxisMpScopeDescriptor: Sendable, Equatable, Codable {
  public let projectID: String
  public let agentID: String
  public let sessionID: String?
  public let scopeLevel: PraxisMpScopeLevel
  public let sessionMode: PraxisMpSessionMode
  public let visibilityState: PraxisMpVisibilityState
  public let promotionState: PraxisMpPromotionState
  public let lineagePath: [String]
  public let metadata: [String: PraxisValue]

  public init(
    projectID: String,
    agentID: String,
    sessionID: String? = nil,
    scopeLevel: PraxisMpScopeLevel = .agentIsolated,
    sessionMode: PraxisMpSessionMode? = nil,
    visibilityState: PraxisMpVisibilityState? = nil,
    promotionState: PraxisMpPromotionState? = nil,
    lineagePath: [String] = [],
    metadata: [String: PraxisValue] = [:]
  ) {
    self.projectID = PraxisMpScopeDescriptor.requireNonEmpty(projectID, label: "MP scope projectID")
    self.agentID = PraxisMpScopeDescriptor.requireNonEmpty(agentID, label: "MP scope agentID")
    self.sessionID = sessionID?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    self.scopeLevel = scopeLevel
    self.sessionMode = sessionMode ?? PraxisMpScopeDescriptor.defaultSessionMode(for: scopeLevel)
    self.visibilityState = visibilityState ?? PraxisMpScopeDescriptor.defaultVisibilityState(
      scopeLevel: scopeLevel,
      sessionMode: self.sessionMode
    )
    self.promotionState = promotionState ?? PraxisMpScopeDescriptor.defaultPromotionState(for: scopeLevel)
    self.lineagePath = PraxisMpScopeDescriptor.normalizeIdentifiers(lineagePath)
    self.metadata = metadata
    precondition(
      (try? PraxisMpScopeDescriptor.validate(self)) != nil,
      "MP scope descriptor contains an invalid scope/session/visibility combination."
    )
  }

  public static func validate(_ scope: PraxisMpScopeDescriptor) throws {
    _ = requireNonEmpty(scope.projectID, label: "MP scope projectID")
    _ = requireNonEmpty(scope.agentID, label: "MP scope agentID")
    if let sessionID = scope.sessionID {
      _ = requireNonEmpty(sessionID, label: "MP scope sessionID")
    }

    switch scope.scopeLevel {
    case .global:
      guard scope.sessionMode == .shared else {
        throw PraxisError.invalidInput("MP global scope requires sessionMode=shared.")
      }
      guard scope.visibilityState == .globalShared || scope.visibilityState == .archived else {
        throw PraxisError.invalidInput("MP global scope requires visibilityState=global_shared or archived.")
      }
    case .project:
      guard scope.sessionMode == .shared else {
        throw PraxisError.invalidInput("MP project scope requires sessionMode=shared.")
      }
      guard scope.visibilityState == .projectShared || scope.visibilityState == .archived else {
        throw PraxisError.invalidInput("MP project scope requires visibilityState=project_shared or archived.")
      }
    case .agentIsolated:
      guard scope.sessionMode != .shared else {
        throw PraxisError.invalidInput("MP agent_isolated scope does not allow sessionMode=shared.")
      }
      if scope.sessionMode == .isolated {
        guard scope.visibilityState == .localOnly || scope.visibilityState == .archived else {
          throw PraxisError.invalidInput("MP isolated agent scope requires visibilityState=local_only or archived.")
        }
      }
      if scope.sessionMode == .bridged {
        guard scope.visibilityState == .sessionBridged || scope.visibilityState == .archived else {
          throw PraxisError.invalidInput("MP bridged agent scope requires visibilityState=session_bridged or archived.")
        }
      }
    }
  }

  public static func canTransitionPromotionState(
    from: PraxisMpPromotionState,
    to: PraxisMpPromotionState
  ) -> Bool {
    promotionTransitions[from, default: []].contains(to)
  }

  public static func assertPromotionTransition(
    from: PraxisMpPromotionState,
    to: PraxisMpPromotionState
  ) throws {
    guard canTransitionPromotionState(from: from, to: to) else {
      throw PraxisError.invalidInput("MP promotion state cannot transition from \(from.rawValue) to \(to.rawValue).")
    }
  }

  private static let promotionTransitions: [PraxisMpPromotionState: Set<PraxisMpPromotionState>] = [
    .localOnly: [.submittedToParent, .archived],
    .submittedToParent: [.acceptedByParent, .archived],
    .acceptedByParent: [.promotedToProject, .archived],
    .promotedToProject: [.promotedToGlobal, .archived],
    .promotedToGlobal: [.archived],
    .archived: [],
  ]

  private static func defaultSessionMode(for scopeLevel: PraxisMpScopeLevel) -> PraxisMpSessionMode {
    switch scopeLevel {
    case .agentIsolated:
      return .isolated
    case .project, .global:
      return .shared
    }
  }

  private static func defaultVisibilityState(
    scopeLevel: PraxisMpScopeLevel,
    sessionMode: PraxisMpSessionMode
  ) -> PraxisMpVisibilityState {
    switch scopeLevel {
    case .global:
      return .globalShared
    case .project:
      return .projectShared
    case .agentIsolated:
      return sessionMode == .bridged ? .sessionBridged : .localOnly
    }
  }

  private static func defaultPromotionState(for scopeLevel: PraxisMpScopeLevel) -> PraxisMpPromotionState {
    switch scopeLevel {
    case .global:
      return .promotedToGlobal
    case .project:
      return .promotedToProject
    case .agentIsolated:
      return .localOnly
    }
  }

  private static func normalizeIdentifiers(_ values: [String]) -> [String] {
    Array(
      Set(
        values
          .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }
      )
    ).sorted()
  }

  private static func requireNonEmpty(_ value: String, label: String) -> String {
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    precondition(!normalized.isEmpty, "\(label) requires a non-empty string.")
    return normalized
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}
