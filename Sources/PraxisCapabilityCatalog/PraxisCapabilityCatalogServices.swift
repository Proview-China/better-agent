import PraxisCapabilityContracts
import PraxisCapabilityPlanning

/// Builds catalog snapshots and family groupings from capability manifests.
public struct PraxisCapabilityCatalogBuilder: Sendable {
  /// Creates the capability catalog builder.
  public init() {}

  /// Builds a catalog snapshot from manifests and optional recent selections.
  ///
  /// - Parameters:
  ///   - manifests: Capability manifests to index.
  ///   - latestSelections: Optional recent selections to attach to entries.
  /// - Returns: A capability catalog snapshot grouped by family.
  public func buildSnapshot(
    manifests: [PraxisCapabilityManifest],
    latestSelections: [PraxisCapabilitySelection] = []
  ) -> PraxisCapabilityCatalogSnapshot {
    let entries = manifests
      .sorted { $0.id.rawValue < $1.id.rawValue }
      .map { manifest in
        PraxisCapabilityCatalogEntry(
          manifest: manifest,
          latestSelection: latestSelections.last(where: { $0.capabilityID == manifest.id })
        )
      }

    return PraxisCapabilityCatalogSnapshot(
      entries: entries,
      families: buildFamilies(manifests: manifests)
    )
  }

  /// Groups manifests into capability families using the identifier prefix before the first dot.
  ///
  /// - Parameter manifests: Capability manifests to group.
  /// - Returns: Sorted capability families derived from the manifests.
  public func buildFamilies(
    manifests: [PraxisCapabilityManifest]
  ) -> [PraxisCapabilityFamily] {
    let grouped = Dictionary(grouping: manifests) { manifest in
      manifest.id.rawValue.split(separator: ".").first.map(String.init) ?? manifest.id.rawValue
    }

    return grouped.keys.sorted().map { familyName in
      let familyManifests = grouped[familyName, default: []]
        .sorted { $0.id.rawValue < $1.id.rawValue }
      return PraxisCapabilityFamily(
        name: familyName,
        capabilityIDs: familyManifests.map(\.id),
        summary: "Capability family for \(familyName)."
      )
    }
  }
}
