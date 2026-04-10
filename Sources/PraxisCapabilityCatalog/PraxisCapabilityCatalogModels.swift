import PraxisCapabilityContracts
import PraxisCapabilityPlanning

/// Named family of capabilities grouped for discovery and baseline views.
public struct PraxisCapabilityFamily: Sendable, Equatable, Codable {
  public let name: String
  public let capabilityIDs: [PraxisCapabilityID]
  public let summary: String?

  /// Creates a capability family.
  ///
  /// - Parameters:
  ///   - name: Stable family name.
  ///   - capabilityIDs: Capability identifiers belonging to the family.
  ///   - summary: Optional human-readable family summary.
  public init(
    name: String,
    capabilityIDs: [PraxisCapabilityID],
    summary: String? = nil
  ) {
    self.name = name
    self.capabilityIDs = capabilityIDs
    self.summary = summary
  }
}

/// Catalog entry combining manifest data with recent selection state.
public struct PraxisCapabilityCatalogEntry: Sendable, Equatable, Codable {
  public let manifest: PraxisCapabilityManifest
  public let latestSelection: PraxisCapabilitySelection?

  /// Creates a capability catalog entry.
  ///
  /// - Parameters:
  ///   - manifest: Manifest represented by the entry.
  ///   - latestSelection: Optional latest selection associated with the manifest.
  public init(
    manifest: PraxisCapabilityManifest,
    latestSelection: PraxisCapabilitySelection?
  ) {
    self.manifest = manifest
    self.latestSelection = latestSelection
  }
}

/// Snapshot of the capability catalog used by runtime and presentation layers.
public struct PraxisCapabilityCatalogSnapshot: Sendable, Equatable, Codable {
  public let entries: [PraxisCapabilityCatalogEntry]
  public let families: [PraxisCapabilityFamily]

  /// Creates a capability catalog snapshot.
  ///
  /// - Parameters:
  ///   - entries: Catalog entries in the snapshot.
  ///   - families: Capability families grouped for discovery.
  public init(
    entries: [PraxisCapabilityCatalogEntry],
    families: [PraxisCapabilityFamily]
  ) {
    self.entries = entries
    self.families = families
  }
}
