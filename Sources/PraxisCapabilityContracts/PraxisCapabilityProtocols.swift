/// Contract surface implemented by a concrete capability binding.
public protocol PraxisCapabilityContract: Sendable {
  /// Static manifest exposed to planners and catalogs.
  var manifest: PraxisCapabilityManifest { get }
  /// Execution policy and governance hints for the capability.
  var executionPolicy: PraxisCapabilityExecutionPolicy { get }
}
