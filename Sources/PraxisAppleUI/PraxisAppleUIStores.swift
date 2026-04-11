import PraxisRuntimePresentationBridge
import SwiftUI

public enum PraxisAppleUIBootstrapError: Error, Sendable {
  case bridgeUnavailable
}

@MainActor
public final class PraxisBridgeStore: ObservableObject {
  @Published public private(set) var presentationState: PraxisPresentationState?

  public let bridge: PraxisApplePresentationBridge?
  public let bootstrapError: Error?

  public init(
    bridge: PraxisApplePresentationBridge,
    presentationState: PraxisPresentationState? = nil,
  ) {
    self.bridge = bridge
    self.bootstrapError = nil
    self.presentationState = presentationState ?? bridge.initialState()
  }

  public init(
    bootstrapError: Error,
    route: PraxisAppleRoute,
  ) {
    self.bridge = nil
    self.bootstrapError = bootstrapError
    self.presentationState = Self.bootstrapFailureState(for: route, error: bootstrapError)
  }

  public convenience init() throws {
    let bridge = try PraxisRuntimeBridgeFactory.makeApplePresentationBridge()
    self.init(bridge: bridge)
  }

  static func live(
    route: PraxisAppleRoute = .architecture,
    bridgeFactory: () throws -> PraxisApplePresentationBridge
  ) -> PraxisBridgeStore {
    do {
      let bridge = try bridgeFactory()
      return PraxisBridgeStore(
        bridge: bridge,
        presentationState: Self.seedState(for: route, bridge: bridge)
      )
    } catch {
      return PraxisBridgeStore(bootstrapError: error, route: route)
    }
  }

  public func loadArchitectureState() {
    guard let bridge else {
      presentationState = Self.bootstrapFailureState(
        for: .architecture,
        error: bootstrapError ?? PraxisAppleUIBootstrapError.bridgeUnavailable
      )
      return
    }
    presentationState = bridge.initialState()
  }

  public func publish(_ state: PraxisPresentationState) {
    presentationState = state
  }

  public func state(for route: PraxisAppleRoute) async throws -> PraxisPresentationState {
    if let bootstrapError {
      throw bootstrapError
    }

    guard let bridge else {
      throw PraxisAppleUIBootstrapError.bridgeUnavailable
    }

    switch route {
    case .architecture:
      return bridge.initialState()
    case .tap:
      return try await bridge.inspectTapState()
    case .cmp:
      return try await bridge.inspectCmpState()
    case .mp:
      return try await bridge.inspectMpState()
    case .capabilityCatalog:
      return try await bridge.buildCapabilityCatalogState()
    }
  }

  static func seedState(
    for route: PraxisAppleRoute,
    bridge: PraxisApplePresentationBridge
  ) -> PraxisPresentationState {
    switch route {
    case .architecture:
      return bridge.initialState()
    case .tap, .cmp, .mp, .capabilityCatalog:
      return PraxisPresentationState(
        title: route.title,
        summary: "Loading \(route.title)..."
      )
    }
  }

  static func bootstrapFailureState(
    for route: PraxisAppleRoute,
    error: Error
  ) -> PraxisPresentationState {
    PraxisPresentationState(
      title: route.title,
      summary: "Failed to bootstrap \(route.title): \(error)"
    )
  }

  static func routeLoadFailureState(
    for route: PraxisAppleRoute,
    error: Error
  ) -> PraxisPresentationState {
    PraxisPresentationState(
      title: route.title,
      summary: "Failed to load \(route.title): \(error)"
    )
  }
}

@MainActor
public final class PraxisAppleAppModel: ObservableObject {
  @Published public var route: PraxisAppleRoute
  public let store: PraxisBridgeStore
  private let routeStateLoader: @MainActor @Sendable (PraxisAppleRoute) async throws -> PraxisPresentationState
  private var routeLoadGeneration: UInt = 0

  public init(route: PraxisAppleRoute = .architecture, store: PraxisBridgeStore) {
    self.route = route
    self.store = store
    self.routeStateLoader = { route in
      try await store.state(for: route)
    }
  }

  init(
    route: PraxisAppleRoute = .architecture,
    store: PraxisBridgeStore,
    routeStateLoader: @escaping @MainActor @Sendable (PraxisAppleRoute) async throws -> PraxisPresentationState
  ) {
    self.route = route
    self.store = store
    self.routeStateLoader = routeStateLoader
  }

  public static func live(route: PraxisAppleRoute = .architecture) -> PraxisAppleAppModel {
    live(
      route: route,
      bridgeFactory: { try PraxisRuntimeBridgeFactory.makeApplePresentationBridge() }
    )
  }

  static func live(
    route: PraxisAppleRoute = .architecture,
    bridgeFactory: () throws -> PraxisApplePresentationBridge
  ) -> PraxisAppleAppModel {
    PraxisAppleAppModel(
      route: route,
      store: PraxisBridgeStore.live(route: route, bridgeFactory: bridgeFactory)
    )
  }

  public func loadCurrentRoute() async {
    routeLoadGeneration += 1
    let requestedRoute = route
    let generation = routeLoadGeneration

    do {
      let state = try await routeStateLoader(requestedRoute)
      guard generation == routeLoadGeneration, requestedRoute == route else {
        return
      }
      store.publish(state)
    } catch {
      guard generation == routeLoadGeneration, requestedRoute == route else {
        return
      }
      store.publish(PraxisBridgeStore.routeLoadFailureState(for: requestedRoute, error: error))
    }
  }
}
