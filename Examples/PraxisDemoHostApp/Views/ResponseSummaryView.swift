import SwiftUI

/// Renders the minimal runtime evidence returned by the demo host client.
///
/// This view stays presentation-only. It does not trigger runtime work or own host state.
struct ResponseSummaryView: View {
  let snapshot: DemoHostRunSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      GroupBox("Negotiated Schema Versions") {
        VStack(alignment: .leading, spacing: 8) {
          labeledValue("Request", value: snapshot.negotiatedRequestSchemaVersion)
          labeledValue("Response", value: snapshot.negotiatedResponseSchemaVersion)
          labeledValue("Event", value: snapshot.negotiatedEventSchemaVersion)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      GroupBox("Run Snapshot") {
        VStack(alignment: .leading, spacing: 8) {
          labeledValue("Session Handle", value: snapshot.sessionHandle)
          labeledValue("Response Status", value: snapshot.responseStatus)
          labeledValue("Snapshot Kind", value: snapshot.snapshotKind)
          labeledValue("Session ID", value: snapshot.sessionID)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      GroupBox("Drained Event Names") {
        if snapshot.drainedEventNames.isEmpty {
          Text("No events were drained from the session.")
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(snapshot.drainedEventNames.enumerated()), id: \.offset) { _, eventName in
              Text(eventName)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
  }

  @ViewBuilder
  private func labeledValue(_ label: String, value: String) -> some View {
    LabeledContent(label) {
      Text(verbatim: value)
        .textSelection(.enabled)
    }
  }
}
