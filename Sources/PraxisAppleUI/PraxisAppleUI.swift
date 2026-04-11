import PraxisRuntimePresentationBridge
import SwiftUI

// TODO(reboot-plan):
// - Replace the current blueprint list screen with a real SwiftUI app shell, navigation flow, and run/session views.
// - Keep all page state sourced from PraxisRuntimePresentationBridge instead of consuming lower-level modules directly.
// - Reserve platform-specific presentation for macOS, iOS, and iPadOS while sharing the runtime bridge model.
// - This file can later be split into AppleAppScene.swift, RootNavigationView.swift, RunDashboardView.swift, and BridgeStore.swift.

public struct PraxisAppleUIRootView: View {
  @StateObject private var model: PraxisAppleAppModel

  public init(model: PraxisAppleAppModel = .live()) {
    _model = StateObject(wrappedValue: model)
  }

  public var body: some View {
    NavigationSplitView {
      List(PraxisAppleRoute.allCases, selection: $model.route) { route in
        VStack(alignment: .leading, spacing: 4) {
          Text(route.title)
            .font(.headline)
          Text(route.rawValue)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
      .navigationTitle("Praxis")
    } detail: {
      PraxisApplePresentationStateView(state: model.store.presentationState)
        .task(id: model.route) {
          await model.loadCurrentRoute()
        }
        .toolbar {
          Button("Reload") {
            Task {
              await model.loadCurrentRoute()
            }
          }
        }
    }
  }
}

private struct PraxisApplePresentationStateView: View {
  let state: PraxisPresentationState?

  var body: some View {
    Group {
      if let state {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
              Text(state.title)
                .font(.largeTitle)
              Text(state.summary)
                .font(.body)
                .foregroundStyle(.secondary)
            }

            if let pendingIntentID = state.pendingIntentID {
              LabeledContent("Pending Intent", value: pendingIntentID)
                .font(.caption)
            }

            if !state.events.isEmpty {
              VStack(alignment: .leading, spacing: 8) {
                Text("Events")
                  .font(.headline)

                ForEach(Array(state.events.enumerated()), id: \.offset) { _, event in
                  VStack(alignment: .leading, spacing: 4) {
                    Text(event.name)
                      .font(.subheadline.weight(.semibold))
                    Text(event.detail)
                      .font(.caption)
                      .foregroundStyle(.secondary)
                  }
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .padding(12)
                  .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 10))
                }
              }
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(24)
        }
      } else {
        ContentUnavailableView("No State", systemImage: "square.stack.3d.up.slash")
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}
