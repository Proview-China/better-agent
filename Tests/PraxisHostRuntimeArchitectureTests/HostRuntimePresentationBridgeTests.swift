import Foundation
import Testing
import PraxisGoal
import PraxisRun
#if canImport(PraxisAppleUI)
@testable import PraxisAppleUI
#endif
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimePresentationBridge

struct HostRuntimePresentationBridgeTests {
  @Test
  @MainActor
  func cliAndApplePresentationBridgesExposeCapabilityCatalogSurface() async throws {
    let hostAdapters = PraxisHostAdapterRegistry.scaffoldDefaults()
    let cliBridge = try PraxisRuntimeBridgeFactory.makeCLICommandBridge(hostAdapters: hostAdapters)
    let appleBridge = try PraxisRuntimeBridgeFactory.makeApplePresentationBridge(hostAdapters: hostAdapters)

    let cliCatalog = try await cliBridge.handle(
      .init(intent: .buildCapabilityCatalog, payloadSummary: "")
    )
    let appleCatalog = try await appleBridge.buildCapabilityCatalogState()

    #expect(cliCatalog.title == "Capability Catalog")
    #expect(cliCatalog.summary.contains("Capability catalog assembled from current boundaries:"))
    #expect(appleCatalog.title == "Capability Catalog")
    #expect(appleCatalog.summary.contains("Registered host capability surfaces:"))
  }

  @Test
  @MainActor
  func applePresentationBridgeBuffersRunEventsAndSharesBootstrapWithFFI() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-apple-bridge-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let hostAdapters = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let bridge = try PraxisRuntimeBridgeFactory.makeApplePresentationBridge(hostAdapters: hostAdapters)
    let ffiBridge = try PraxisRuntimeBridgeFactory.makeFFIBridge(hostAdapters: hostAdapters)
    let goal = PraxisCompiledGoal(
      normalizedGoal: .init(
        id: .init(rawValue: "apple.goal.catalog"),
        title: "Apple bridge goal",
        summary: "Validate presentation event buffering"
      ),
      intentSummary: "Validate presentation event buffering"
    )

    let initialState = bridge.initialState()
    let runState = try await bridge.runGoalState(goal)
    let snapshotEvents = await bridge.snapshotEvents()
    let drainedEvents = await bridge.drainEvents()
    let eventsAfterDrain = await bridge.snapshotEvents()

    #expect(initialState.title == "Praxis Architecture")
    #expect(runState.title.hasPrefix("Run run:"))
    #expect(runState.title.contains("apple.goal.catalog"))
    #expect(runState.events.map(\.name) == ["run.started", "run.follow_up_ready"])
    #expect(snapshotEvents.map(\.name) == ["run.started", "run.follow_up_ready"])
    #expect(drainedEvents == snapshotEvents)
    #expect(eventsAfterDrain.isEmpty)
    #expect(ffiBridge.exportArchitectureSnapshot() == PraxisRuntimePresentationBridgeModule.bootstrap)
  }

  #if canImport(PraxisAppleUI)
  @Test
  @MainActor
  func appleBridgeStoreAndAppModelFollowSelectedRoute() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-apple-store-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let hostAdapters = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let bridge = try PraxisRuntimeBridgeFactory.makeApplePresentationBridge(hostAdapters: hostAdapters)
    let seedState = PraxisPresentationState(title: "Seed", summary: "Injected state")
    let store = PraxisBridgeStore(bridge: bridge, presentationState: seedState)
    guard let capabilityCatalogRoute = PraxisAppleRoute(rawValue: "capabilityCatalog"),
          let cmpRoute = PraxisAppleRoute(rawValue: "cmp"),
          let architectureRoute = PraxisAppleRoute(rawValue: "architecture") else {
      Issue.record("Expected AppleUI routes to expose architecture/cmp/capabilityCatalog.")
      return
    }
    let model = PraxisAppleAppModel(route: capabilityCatalogRoute, store: store)

    #expect(store.presentationState == seedState)

    await model.loadCurrentRoute()
    #expect(store.presentationState?.title == "Capability Catalog")
    #expect(store.presentationState?.summary.contains("Capability catalog assembled from current boundaries:") == true)

    model.route = cmpRoute
    await model.loadCurrentRoute()
    #expect(store.presentationState?.title == "CMP Inspection")
    #expect(store.presentationState?.summary.contains("cmp.local-runtime") == true)

    model.route = architectureRoute
    await model.loadCurrentRoute()
    #expect(store.presentationState?.title == "Praxis Architecture")
  }

  @Test
  @MainActor
  func liveAppModelSeedsNonDefaultRouteAndSurfacesBootstrapFailure() throws {
    enum BootstrapFailure: Error {
      case brokenBridge
    }

    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-apple-live-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: rootDirectory) }

    let hostAdapters = PraxisHostAdapterRegistry.localDefaults(rootDirectory: rootDirectory)
    let seededCmpModel = PraxisAppleAppModel.live(
      route: .cmp,
      bridgeFactory: {
        try PraxisRuntimeBridgeFactory.makeApplePresentationBridge(hostAdapters: hostAdapters)
      }
    )
    let capabilityCatalogModel = PraxisAppleAppModel.live(
      route: .capabilityCatalog,
      bridgeFactory: {
        throw BootstrapFailure.brokenBridge
      }
    )
    let cmpModel = PraxisAppleAppModel.live(
      route: .cmp,
      bridgeFactory: {
        throw BootstrapFailure.brokenBridge
      }
    )

    #expect(seededCmpModel.store.presentationState?.title == "CMP")
    #expect(seededCmpModel.store.presentationState?.summary == "Loading CMP...")
    #expect(capabilityCatalogModel.store.presentationState?.title == "Capability Catalog")
    #expect(capabilityCatalogModel.store.presentationState?.summary.contains("Failed to bootstrap Capability Catalog") == true)
    #expect(cmpModel.store.presentationState?.title == "CMP")
    #expect(cmpModel.store.presentationState?.summary.contains("Failed to bootstrap CMP") == true)
  }

  @Test
  @MainActor
  func appleAppModelDropsStaleRouteLoadsBeforePublishing() async {
    let store = PraxisBridgeStore(
      bootstrapError: PraxisAppleUIBootstrapError.bridgeUnavailable,
      route: .tap
    )

    var continuations: [PraxisAppleRoute: CheckedContinuation<PraxisPresentationState, Error>] = [:]
    let model = PraxisAppleAppModel(
      route: .tap,
      store: store,
      routeStateLoader: { route in
        try await withCheckedThrowingContinuation { continuation in
          continuations[route] = continuation
        }
      }
    )

    let firstLoad = Task {
      await model.loadCurrentRoute()
    }
    await Task.yield()

    model.route = .cmp
    let secondLoad = Task {
      await model.loadCurrentRoute()
    }
    await Task.yield()

    continuations[.cmp]?.resume(
      returning: .init(title: "CMP Inspection", summary: "cmp latest")
    )
    await secondLoad.value

    continuations[.tap]?.resume(
      returning: .init(title: "TAP Inspection", summary: "tap stale")
    )
    await firstLoad.value

    #expect(store.presentationState?.title == "CMP Inspection")
    #expect(store.presentationState?.summary == "cmp latest")
  }

  @Test
  @MainActor
  func appleAppModelRouteLoadFailureDoesNotUseBootstrapMessage() async {
    enum RouteLoadFailure: Error {
      case tapUnavailable
    }

    let store = PraxisBridgeStore(
      bootstrapError: PraxisAppleUIBootstrapError.bridgeUnavailable,
      route: .tap
    )
    let model = PraxisAppleAppModel(
      route: .tap,
      store: store,
      routeStateLoader: { _ in
        throw RouteLoadFailure.tapUnavailable
      }
    )

    await model.loadCurrentRoute()

    #expect(store.presentationState?.title == "TAP")
    #expect(store.presentationState?.summary.contains("Failed to load TAP") == true)
    #expect(store.presentationState?.summary.contains("Failed to bootstrap") == false)
  }
  #endif
}
