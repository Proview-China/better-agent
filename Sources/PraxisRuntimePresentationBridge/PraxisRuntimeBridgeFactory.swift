import PraxisRuntimeComposition
import PraxisRuntimeFacades
import PraxisRuntimeGateway

public enum PraxisRuntimeBridgeFactory {
  private static let sharedLocalHostAdapters = PraxisHostAdapterRegistry.localDefaults()

  static func makeCompositionRoot() -> PraxisRuntimeCompositionRoot {
    PraxisRuntimeGatewayFactory.makeCompositionRoot(
      hostAdapters: sharedLocalHostAdapters,
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
    )
  }

  static func makeCompositionRoot(
    hostAdapters: PraxisHostAdapterRegistry = sharedLocalHostAdapters,
    blueprint: PraxisRuntimeBlueprint = PraxisRuntimePresentationBridgeModule.bootstrap
  ) -> PraxisRuntimeCompositionRoot {
    PraxisRuntimeGatewayFactory.makeCompositionRoot(hostAdapters: hostAdapters, blueprint: blueprint)
  }

  static func makeRuntimeFacade() throws -> PraxisRuntimeFacade {
    try PraxisRuntimeGatewayFactory.makeRuntimeFacade(
      hostAdapters: sharedLocalHostAdapters,
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap
    )
  }

  static func makeRuntimeFacade(
    hostAdapters: PraxisHostAdapterRegistry = sharedLocalHostAdapters,
    blueprint: PraxisRuntimeBlueprint = PraxisRuntimePresentationBridgeModule.bootstrap
  ) throws -> PraxisRuntimeFacade {
    try PraxisRuntimeGatewayFactory.makeRuntimeFacade(hostAdapters: hostAdapters, blueprint: blueprint)
  }

  public static func makeCLICommandBridge() throws -> PraxisCLICommandBridge {
    try makeCLICommandBridge(
      hostAdapters: sharedLocalHostAdapters,
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap,
      stateMapper: .init()
    )
  }

  static func makeCLICommandBridge(
    hostAdapters: PraxisHostAdapterRegistry = sharedLocalHostAdapters,
    blueprint: PraxisRuntimeBlueprint = PraxisRuntimePresentationBridgeModule.bootstrap,
    stateMapper: PraxisPresentationStateMapper = .init()
  ) throws -> PraxisCLICommandBridge {
    PraxisCLICommandBridge(
      runtimeFacade: try makeRuntimeFacade(hostAdapters: hostAdapters, blueprint: blueprint),
      stateMapper: stateMapper
    )
  }

  @MainActor
  public static func makeApplePresentationBridge() throws -> PraxisApplePresentationBridge {
    try makeApplePresentationBridge(
      hostAdapters: sharedLocalHostAdapters,
      blueprint: PraxisRuntimePresentationBridgeModule.bootstrap,
      stateMapper: .init()
    )
  }

  @MainActor
  static func makeApplePresentationBridge(
    hostAdapters: PraxisHostAdapterRegistry = sharedLocalHostAdapters,
    blueprint: PraxisRuntimeBlueprint = PraxisRuntimePresentationBridgeModule.bootstrap,
    stateMapper: PraxisPresentationStateMapper = .init()
  ) throws -> PraxisApplePresentationBridge {
    PraxisApplePresentationBridge(
      runtimeFacade: try makeRuntimeFacade(hostAdapters: hostAdapters, blueprint: blueprint),
      stateMapper: stateMapper
    )
  }

}
