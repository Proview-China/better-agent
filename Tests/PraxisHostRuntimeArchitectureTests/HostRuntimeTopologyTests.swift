import Foundation
import Testing
@testable import PraxisFFI
@testable import PraxisRuntimeComposition
@testable import PraxisRuntimeFacades
@testable import PraxisRuntimeGateway
@testable import PraxisRuntimeInterface
@testable import PraxisRuntimePresentationBridge
@testable import PraxisRuntimeUseCases

struct HostRuntimeTopologyTests {
  private let expectedGatewayEntrypoints: Set<String> = [
    "PraxisCLI",
    "PraxisFFI",
  ]

  private let expectedGatewayRules: Set<String> = [
    "PraxisRuntimeInterface / PraxisRuntimeGateway / PraxisRuntimeFacades / PraxisRuntimeUseCases 构成宿主无关中间层；request / response / event / DTO 不能泄漏 CLI、SwiftUI、terminal、platform 或 provider raw payload 语义。",
    "CLI / 导出入口只能经由 RuntimeGateway -> RuntimeInterface 进入系统。",
    "RuntimeGateway 只负责 portal-agnostic bootstrap 与 runtime access，不吸收 CLI、SwiftUI、terminal 或 platform 细节。",
  ]

  private let expectedPresentationBridgeEntrypoints: Set<String> = [
    "PraxisAppleUI",
  ]

  private let expectedPresentationBridgeRules: Set<String> = [
    "PraxisRuntimeInterface / PraxisRuntimeGateway / PraxisRuntimeFacades / PraxisRuntimeUseCases 构成宿主无关中间层；request / response / event / DTO 不能泄漏 CLI、SwiftUI、terminal、platform 或 provider raw payload 语义。",
    "CLI / 导出入口只能经由 RuntimeGateway -> RuntimeInterface 进入系统。",
    "RuntimeGateway 只负责 portal-agnostic bootstrap 与 runtime access，不吸收 CLI、SwiftUI、terminal 或 platform 细节。",
    "RuntimePresentationBridge 只做展示映射，不定义宿主无关 runtime contract 真相。",
    "PraxisAppleUI 只能通过 PraxisRuntimePresentationBridge 访问 runtime；当前允许直接 import 的模块集合仅包含 PraxisRuntimePresentationBridge、SwiftUI、Foundation。",
  ]

  @Test
  func runtimeSplitIncludesDedicatedFfiTarget() {
    #expect(PraxisRuntimeCompositionModule.boundary.name == "PraxisRuntimeComposition")
    #expect(PraxisRuntimeUseCasesModule.boundary.name == "PraxisRuntimeUseCases")
    #expect(PraxisRuntimeFacadesModule.boundary.name == "PraxisRuntimeFacades")
    #expect(PraxisRuntimeInterfaceModule.boundary.name == "PraxisRuntimeInterface")
    #expect(PraxisRuntimeGatewayModule.boundary.name == "PraxisRuntimeGateway")
    #expect(PraxisFFIModule.boundary.name == "PraxisFFI")
    #expect(PraxisRuntimePresentationBridgeModule.boundary.name == "PraxisRuntimePresentationBridge")
  }

  @Test
  func gatewayBlueprintPinsHostNeutralEntryRules() {
    #expect(Set(PraxisRuntimeGatewayModule.bootstrap.entrypoints) == expectedGatewayEntrypoints)
    #expect(PraxisRuntimeGatewayModule.bootstrap.entrypoints.count == expectedGatewayEntrypoints.count)
    #expect(PraxisRuntimeGatewayModule.bootstrap.entrypoints.contains("PraxisAppleUI") == false)
    #expect(Set(PraxisRuntimeGatewayModule.bootstrap.rules) == expectedGatewayRules)
    #expect(PraxisRuntimeGatewayModule.bootstrap.rules.count == expectedGatewayRules.count)
    #expect(
      PraxisRuntimeGatewayModule.bootstrap.rules.contains(
        "CLI / 导出入口只能经由 RuntimeGateway -> RuntimeInterface 进入系统。"
      )
    )
  }

  @Test
  func presentationBridgeBlueprintMatchesSplitAndDeclaresPresentationOnlyRole() {
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.hostContractModules.count == 5)
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.runtimeModules.count == 6)
    #expect(Set(PraxisRuntimePresentationBridgeModule.bootstrap.entrypoints) == expectedPresentationBridgeEntrypoints)
    #expect(
      PraxisRuntimePresentationBridgeModule.bootstrap.entrypoints.count
        == expectedPresentationBridgeEntrypoints.count
    )
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.entrypoints.contains("PraxisAppleUI"))
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.entrypoints.contains("PraxisCLI") == false)
    #expect(PraxisRuntimePresentationBridgeModule.bootstrap.entrypoints.contains("PraxisFFI") == false)
    #expect(
      PraxisRuntimePresentationBridgeModule.bootstrap.rules.contains(
        "RuntimePresentationBridge 只做展示映射，不定义宿主无关 runtime contract 真相。"
      )
    )
    #expect(Set(PraxisRuntimePresentationBridgeModule.bootstrap.rules) == expectedPresentationBridgeRules)
    #expect(
      PraxisRuntimePresentationBridgeModule.bootstrap.rules.count
        == expectedPresentationBridgeRules.count
    )
  }

  @Test
  func ffiTargetIsDeclaredSeparatelyFromPresentationBridgeOwnership() throws {
    let projectRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let packageManifest = try String(contentsOf: projectRoot.appendingPathComponent("Package.swift"))
    let presentationBridgeFactory = try String(
      contentsOf: projectRoot.appendingPathComponent(
        "Sources/PraxisRuntimePresentationBridge/PraxisRuntimeBridgeFactory.swift"
      )
    )
    let presentationModels = try String(
      contentsOf: projectRoot.appendingPathComponent(
        "Sources/PraxisRuntimePresentationBridge/PraxisPresentationModels.swift"
      )
    )
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
    #expect(presentationBridgeFactory.contains("makeFFIBridge") == false)
    #expect(presentationBridgeFactory.contains("makeRuntimeInterface") == false)
    #expect(presentationBridgeFactory.contains("makeRuntimeInterfaceRegistry") == false)
    #expect(presentationModels.contains("PraxisFFIEventEnvelope") == false)
    #expect(ffiBridgeSource.contains("public final class PraxisFFIBridge"))
  }
}
