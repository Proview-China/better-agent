import OSLog

enum DemoHostTelemetryEvent: String, Sendable {
  case userTriggeredDemoRun = "demo_run.triggered"
  case architectureNegotiationStarted = "architecture_negotiation.started"
  case architectureNegotiationSucceeded = "architecture_negotiation.succeeded"
  case architectureNegotiationFailed = "architecture_negotiation.failed"
  case runGoalStarted = "run_goal.started"
  case runGoalSucceeded = "run_goal.succeeded"
  case runGoalFailed = "run_goal.failed"
  case eventDrainSucceeded = "event_drain.succeeded"
  case eventDrainFailed = "event_drain.failed"
  case uiRunSucceeded = "ui_run.succeeded"
  case uiRunFailed = "ui_run.failed"
}

private enum DemoHostTelemetryCategory: String {
  case ui
  case runtime
}

/// Emits the minimal unified logging telemetry used by the native demo host app.
///
/// This helper exists only to keep subsystem/category choices and lifecycle event names stable for
/// the build script's `--telemetry` mode. It is not a general analytics or tracing layer.
enum DemoHostTelemetry {
  static let subsystem = "dev.praxis.PraxisDemoHostApp"

  private static let uiLogger = Logger(subsystem: subsystem, category: DemoHostTelemetryCategory.ui.rawValue)
  private static let runtimeLogger = Logger(
    subsystem: subsystem,
    category: DemoHostTelemetryCategory.runtime.rawValue
  )

  static func userTriggeredDemoRun() {
    emit(.userTriggeredDemoRun, category: .ui)
  }

  static func architectureNegotiationStarted(handle: String) {
    emit(.architectureNegotiationStarted, category: .runtime, details: "handle=\(handle)")
  }

  static func architectureNegotiationSucceeded(
    handle: String,
    requestSchemaVersion: String,
    responseSchemaVersion: String,
    eventSchemaVersion: String
  ) {
    emit(
      .architectureNegotiationSucceeded,
      category: .runtime,
      details: "handle=\(handle) requestSchemaVersion=\(requestSchemaVersion) responseSchemaVersion=\(responseSchemaVersion) eventSchemaVersion=\(eventSchemaVersion)"
    )
  }

  static func architectureNegotiationFailed(handle: String, error: String) {
    emit(.architectureNegotiationFailed, category: .runtime, details: "handle=\(handle) error=\(error)")
  }

  static func runGoalStarted(handle: String, goalID: String, sessionID: String) {
    emit(
      .runGoalStarted,
      category: .runtime,
      details: "handle=\(handle) goalID=\(goalID) sessionID=\(sessionID)"
    )
  }

  static func runGoalSucceeded(handle: String, snapshotKind: String, sessionID: String) {
    emit(
      .runGoalSucceeded,
      category: .runtime,
      details: "handle=\(handle) snapshotKind=\(snapshotKind) sessionID=\(sessionID)"
    )
  }

  static func runGoalFailed(handle: String, error: String) {
    emit(.runGoalFailed, category: .runtime, details: "handle=\(handle) error=\(error)")
  }

  static func eventDrainSucceeded(handle: String, eventNames: [String]) {
    let joinedNames = eventNames.isEmpty ? "none" : eventNames.joined(separator: ",")
    emit(
      .eventDrainSucceeded,
      category: .runtime,
      details: "handle=\(handle) eventCount=\(eventNames.count) eventNames=\(joinedNames)"
    )
  }

  static func eventDrainFailed(handle: String, error: String) {
    emit(.eventDrainFailed, category: .runtime, details: "handle=\(handle) error=\(error)")
  }

  static func uiRunSucceeded(sessionHandle: String, sessionID: String, drainedEventCount: Int) {
    emit(
      .uiRunSucceeded,
      category: .ui,
      details: "sessionHandle=\(sessionHandle) sessionID=\(sessionID) drainedEventCount=\(drainedEventCount)"
    )
  }

  static func uiRunFailed(error: String) {
    emit(.uiRunFailed, category: .ui, details: "error=\(error)")
  }

  private static func emit(
    _ event: DemoHostTelemetryEvent,
    category: DemoHostTelemetryCategory,
    details: String? = nil
  ) {
    let message = details.map { "\(event.rawValue) \($0)" } ?? event.rawValue

    switch category {
    case .ui:
      uiLogger.notice("\(message, privacy: .public)")
    case .runtime:
      runtimeLogger.notice("\(message, privacy: .public)")
    }
  }
}
