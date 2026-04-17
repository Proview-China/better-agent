import Testing
@testable import PraxisDemoHostApp

struct DemoHostTelemetryTests {
  @Test
  func telemetrySubsystemMatchesDemoHostLogFilter() {
    #expect(DemoHostTelemetry.subsystem == "dev.praxis.PraxisDemoHostApp")
  }

  @Test
  func telemetryEventSetCoversRequiredLifecycleMarkers() {
    #expect(DemoHostTelemetryEvent.userTriggeredDemoRun.rawValue == "demo_run.triggered")
    #expect(DemoHostTelemetryEvent.architectureNegotiationStarted.rawValue == "architecture_negotiation.started")
    #expect(DemoHostTelemetryEvent.architectureNegotiationSucceeded.rawValue == "architecture_negotiation.succeeded")
    #expect(DemoHostTelemetryEvent.architectureNegotiationFailed.rawValue == "architecture_negotiation.failed")
    #expect(DemoHostTelemetryEvent.runGoalStarted.rawValue == "run_goal.started")
    #expect(DemoHostTelemetryEvent.runGoalSucceeded.rawValue == "run_goal.succeeded")
    #expect(DemoHostTelemetryEvent.runGoalFailed.rawValue == "run_goal.failed")
    #expect(DemoHostTelemetryEvent.eventDrainSucceeded.rawValue == "event_drain.succeeded")
    #expect(DemoHostTelemetryEvent.eventDrainFailed.rawValue == "event_drain.failed")
    #expect(DemoHostTelemetryEvent.uiRunSucceeded.rawValue == "ui_run.succeeded")
    #expect(DemoHostTelemetryEvent.uiRunFailed.rawValue == "ui_run.failed")
  }
}
