import SwiftUI

/// Hosts the minimal native demo-host layout and action wiring.
///
/// The root view intentionally exposes only one bounded flow: connect, negotiate architecture,
/// run one demo goal, and render the returned response/event evidence.
struct DemoHostRootView: View {
  let client: PraxisDemoHostClient

  @State private var isRunning = false
  @State private var statusMessage = "Ready to open one runtime session."
  @State private var errorMessage: String?
  @State private var snapshot: DemoHostRunSnapshot?

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Praxis Demo Host")
          .font(.title2.weight(.semibold))
        Text("Open the FFI bridge, negotiate architecture, run one fixed demo goal, and inspect the returned runtime evidence.")
          .foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }

      HStack(spacing: 12) {
        Button("Connect And Run Demo") {
          runDemo()
        }
        .buttonStyle(.borderedProminent)
        .disabled(isRunning)

        if isRunning {
          ProgressView()
            .controlSize(.small)
        }

        Text(statusMessage)
          .foregroundStyle(.secondary)
          .textSelection(.enabled)
      }

      if let errorMessage {
        GroupBox("Last Error") {
          Text(errorMessage)
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .textSelection(.enabled)
        }
      }

      GroupBox("Latest Result") {
        if let snapshot {
          ResponseSummaryView(snapshot: snapshot)
        } else {
          ContentUnavailableView(
            "No Demo Result Yet",
            systemImage: "macwindow",
            description: Text("Run the fixed demo goal to inspect negotiated schema versions, session identity, and drained event names.")
          )
          .frame(maxWidth: .infinity, minHeight: 240)
        }
      }
    }
    .padding(24)
    .frame(minWidth: 680, minHeight: 460, alignment: .topLeading)
  }

  private func runDemo() {
    DemoHostTelemetry.userTriggeredDemoRun()
    isRunning = true
    statusMessage = "Opening bridge session and negotiating architecture..."
    errorMessage = nil

    Task {
      do {
        let snapshot = try await client.runDemo()
        await MainActor.run {
          self.snapshot = snapshot
          isRunning = false
          statusMessage = "Demo goal completed."
          DemoHostTelemetry.uiRunSucceeded(
            sessionHandle: snapshot.sessionHandle,
            sessionID: snapshot.sessionID,
            drainedEventCount: snapshot.drainedEventNames.count
          )
        }
      } catch {
        await MainActor.run {
          snapshot = nil
          isRunning = false
          errorMessage = error.localizedDescription
          statusMessage = "Demo goal failed."
          DemoHostTelemetry.uiRunFailed(error: error.localizedDescription)
        }
      }
    }
  }
}
