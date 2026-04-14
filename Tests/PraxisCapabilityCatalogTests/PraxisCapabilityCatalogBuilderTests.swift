import Testing
@testable import PraxisCapabilityCatalog
@testable import PraxisCapabilityContracts
@testable import PraxisCapabilityPlanning

struct PraxisCapabilityCatalogBuilderTests {
  @Test
  func buildSnapshotGroupsEntriesIntoFamiliesAndCarriesLatestSelection() {
    let manifests: [PraxisCapabilityManifest] = [
      .init(
        id: .init(rawValue: "code.read"),
        name: "Code Read",
        summary: "Read workspace files."
      ),
      .init(
        id: .init(rawValue: "search.web"),
        name: "Web Search",
        summary: "Search the web."
      ),
      .init(
        id: .init(rawValue: "mp.resolve"),
        name: "MP Resolve",
        summary: "Resolve memory bundles."
      ),
    ]
    let selection = PraxisCapabilitySelection(
      capabilityID: .init(rawValue: "search.web"),
      reason: "Matched explicit capability constraint from goal."
    )

    let snapshot = PraxisCapabilityCatalogBuilder().buildSnapshot(
      manifests: manifests,
      latestSelections: [selection]
    )

    #expect(snapshot.entries.count == 3)
    #expect(snapshot.families.map(\.name) == ["code", "mp", "search"])
    #expect(snapshot.entries.first(where: { $0.manifest.id.rawValue == "search.web" })?.latestSelection == selection)
  }

  @Test
  func buildThinCapabilityBaselinePublishesPhaseThreeManifestSet() {
    let baseline = PraxisCapabilityCatalogBuilder().buildThinCapabilityBaseline()
    let snapshot = PraxisCapabilityCatalogBuilder().buildSnapshot(manifests: baseline.manifests)

    #expect(baseline.manifests.count == 10)
    #expect(snapshot.families.map(\.name) == ["batch", "embed", "file", "generate", "search", "session", "tool"])
    #expect(snapshot.entries.map(\.manifest.id.rawValue).contains("generate.create"))
    #expect(snapshot.entries.map(\.manifest.id.rawValue).contains("generate.stream"))
    #expect(snapshot.entries.map(\.manifest.id.rawValue).contains("session.open"))
    #expect(snapshot.entries.map(\.manifest.id.rawValue).contains("search.web"))
    #expect(snapshot.entries.map(\.manifest.id.rawValue).contains("search.fetch"))
    #expect(snapshot.entries.map(\.manifest.id.rawValue).contains("search.ground"))
  }
}
