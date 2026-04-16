import Foundation
import Testing
@testable import PraxisFFI
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeFacades
@testable import PraxisRuntimeGateway
@testable import PraxisRuntimeInterface
@testable import PraxisRuntimeKit
@testable import PraxisRuntimeUseCases

struct HostRuntimeTopologyTests {
  private let expectedGatewayEntrypoints: Set<String> = [
    "PraxisFFI",
  ]

  private let expectedGatewayRules: Set<String> = [
    "PraxisRuntimeInterface / PraxisRuntimeGateway / PraxisRuntimeFacades / PraxisRuntimeUseCases 构成宿主无关中间层；request / response / event / DTO 不能泄漏 CLI、GUI、SwiftUI、terminal、platform 或 provider raw payload 语义。",
    "Framework 调用面与导出入口只能经由 RuntimeGateway -> RuntimeInterface 进入系统。",
    "RuntimeGateway 只负责 framework-first bootstrap 与 runtime access，不吸收 CLI、GUI、SwiftUI、terminal 或 platform 细节。",
  ]

  @Test
  func runtimeSplitIncludesDedicatedFfiTarget() {
    #expect(PraxisRuntimeCompositionModule.boundary.name == "PraxisRuntimeComposition")
    #expect(PraxisRuntimeUseCasesModule.boundary.name == "PraxisRuntimeUseCases")
    #expect(PraxisRuntimeFacadesModule.boundary.name == "PraxisRuntimeFacades")
    #expect(PraxisRuntimeInterfaceModule.boundary.name == "PraxisRuntimeInterface")
    #expect(PraxisRuntimeGatewayModule.boundary.name == "PraxisRuntimeGateway")
    #expect(PraxisFFIModule.boundary.name == "PraxisFFI")
    #expect(PraxisRuntimeKitModule.boundary.name == "PraxisRuntimeKit")
  }

  @Test
  func gatewayBlueprintPinsHostNeutralEntryRules() {
    #expect(Set(PraxisRuntimeGatewayModule.bootstrap.entrypoints) == expectedGatewayEntrypoints)
    #expect(PraxisRuntimeGatewayModule.bootstrap.entrypoints.count == expectedGatewayEntrypoints.count)
    #expect(Set(PraxisRuntimeGatewayModule.bootstrap.rules) == expectedGatewayRules)
    #expect(PraxisRuntimeGatewayModule.bootstrap.rules.count == expectedGatewayRules.count)
    #expect(
      PraxisRuntimeGatewayModule.bootstrap.rules.contains(
        "Framework 调用面与导出入口只能经由 RuntimeGateway -> RuntimeInterface 进入系统。"
      )
    )
  }

  @Test
  func gatewayBlueprintNoLongerTreatsPresentationShellsAsEntrypoints() {
    #expect(PraxisRuntimeGatewayModule.bootstrap.entrypoints.contains("PraxisCLI") == false)
    #expect(PraxisRuntimeGatewayModule.bootstrap.entrypoints.contains("PraxisAppleUI") == false)
    #expect(PraxisRuntimeGatewayModule.bootstrap.entrypoints.contains("PraxisRuntimePresentationBridge") == false)
  }

  @Test
  func ffiTargetIsDeclaredSeparatelyFromHostRuntimeOwnership() throws {
    let projectRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let packageManifest = try String(contentsOf: projectRoot.appendingPathComponent("Package.swift"))
    let ffiBridgeSource = try String(
      contentsOf: projectRoot.appendingPathComponent("Sources/PraxisFFI/PraxisFFIBridge.swift")
    )
    guard let ffiTargetStart = packageManifest.range(of: #"name: "PraxisFFI""#)?.lowerBound,
          let ffiTargetEnd = packageManifest[ffiTargetStart...].range(of: #"path: "Sources/PraxisFFI""#)?.upperBound else {
      Issue.record("Expected Package.swift to declare a dedicated PraxisFFI target block.")
      return
    }
    let ffiTargetBlock = String(packageManifest[ffiTargetStart..<ffiTargetEnd])

    #expect(packageManifest.contains(#"name: "PraxisFFI""#))
    #expect(packageManifest.contains(#"path: "Sources/PraxisFFI""#))
    #expect(ffiTargetBlock.contains(#""PraxisRuntimeGateway""#))
    #expect(ffiTargetBlock.contains(#""PraxisRuntimeInterface""#))
    #expect(ffiTargetBlock.contains(#""PraxisRuntimeComposition""#) == false)
    #expect(ffiTargetBlock.contains(#""PraxisRuntimeFacades""#) == false)
    #expect(packageManifest.contains(#"name: "PraxisRuntimePresentationBridge""#) == false)
    #expect(packageManifest.contains(#"name: "PraxisCLI""#) == false)
    #expect(packageManifest.contains(#"name: "PraxisAppleUI""#) == false)
    #expect(ffiBridgeSource.contains("public final class PraxisFFIBridge"))
  }

  @Test
  func runtimeKitTargetDeclaresCallerFriendlySurfaceWithoutTransportOwnership() throws {
    let projectRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let packageManifest = try String(contentsOf: projectRoot.appendingPathComponent("Package.swift"))

    guard let runtimeKitStart = packageManifest.range(
      of: #"name: "PraxisRuntimeKit","#,
      options: .backwards
    )?.lowerBound,
          let runtimeKitEnd = packageManifest[runtimeKitStart...].range(of: #"path: "Sources/PraxisRuntimeKit""#)?.upperBound else {
      Issue.record("Expected Package.swift to declare a dedicated PraxisRuntimeKit target block.")
      return
    }

    let runtimeKitTargetBlock = String(packageManifest[runtimeKitStart..<runtimeKitEnd])

    #expect(packageManifest.contains(#".library(name: "PraxisRuntimeKit", targets: ["PraxisRuntimeKit"])"#))
    #expect(runtimeKitTargetBlock.contains(#""PraxisRuntimeGateway""#))
    #expect(runtimeKitTargetBlock.contains(#""PraxisRuntimeFacades""#))
    #expect(runtimeKitTargetBlock.contains(#""PraxisRuntimeComposition""#) == false)
    #expect(runtimeKitTargetBlock.contains(#""PraxisRuntimeInterface""#) == false)
    #expect(runtimeKitTargetBlock.contains(#""PraxisFFI""#) == false)
  }

  @Test
  func ffiEmbeddingExampleIsPublishedAsAnExecutableProduct() throws {
    let projectRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let packageManifest = try String(contentsOf: projectRoot.appendingPathComponent("Package.swift"))

    #expect(packageManifest.contains(#".executable(name: "PraxisFFIEmbeddingExample", targets: ["PraxisFFIEmbeddingExample"])"#))
    #expect(packageManifest.contains(#"name: "PraxisFFIEmbeddingExample""#))
    #expect(packageManifest.contains(#"path: "Examples/PraxisFFIEmbeddingExample""#))
    #expect(packageManifest.contains(#""PraxisFFI""#))
    #expect(packageManifest.contains(#""PraxisRuntimeInterface""#))
  }

  @Test
  func appleHostEmbeddingExampleIsPublishedAsAnExecutableProduct() throws {
    let projectRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let packageManifest = try String(contentsOf: projectRoot.appendingPathComponent("Package.swift"))

    #expect(packageManifest.contains(#".executable(name: "PraxisAppleHostEmbeddingExample", targets: ["PraxisAppleHostEmbeddingExample"])"#))
    #expect(packageManifest.contains(#"name: "PraxisAppleHostEmbeddingExample""#))
    #expect(packageManifest.contains(#"path: "Examples/PraxisAppleHostEmbeddingExample""#))
    #expect(packageManifest.contains(#""PraxisFFI""#))
    #expect(packageManifest.contains(#""PraxisRuntimeInterface""#))
  }

  @Test
  func exportBaselineExampleIsPublishedAsAnExecutableProduct() throws {
    let projectRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let packageManifest = try String(contentsOf: projectRoot.appendingPathComponent("Package.swift"))

    #expect(packageManifest.contains(#".executable(name: "PraxisExportBaselineExample", targets: ["PraxisExportBaselineExample"])"#))
    #expect(packageManifest.contains(#"name: "PraxisExportBaselineExample""#))
    #expect(packageManifest.contains(#"path: "Examples/PraxisExportBaselineExample""#))
    #expect(packageManifest.contains(#""PraxisFFI""#))
    #expect(packageManifest.contains(#""PraxisRuntimeInterface""#))
  }
}
