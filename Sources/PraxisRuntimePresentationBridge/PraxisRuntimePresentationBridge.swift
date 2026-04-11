import PraxisCapabilityCatalog
import PraxisCapabilityContracts
import PraxisCapabilityPlanning
import PraxisCapabilityResults
import PraxisCheckpoint
import PraxisCmpDbModel
import PraxisCmpDelivery
import PraxisCmpFiveAgent
import PraxisCmpGitModel
import PraxisCmpMqModel
import PraxisCmpProjection
import PraxisCmpSections
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisGoal
import PraxisInfraContracts
import PraxisJournal
import PraxisMpFiveAgent
import PraxisMpMemory
import PraxisMpSearch
import PraxisMpTypes
import PraxisProviderContracts
import PraxisRun
import PraxisRuntimeComposition
import PraxisRuntimeFacades
import PraxisRuntimeGateway
import PraxisRuntimeInterface
import PraxisRuntimeUseCases
import PraxisSession
import PraxisState
import PraxisTapAvailability
import PraxisTapGovernance
import PraxisTapProvision
import PraxisTapReview
import PraxisTapRuntime
import PraxisTapTypes
import PraxisToolingContracts
import PraxisTransition
import PraxisUserIOContracts
import PraxisWorkspaceContracts

// TODO(reboot-plan):
// - Implement presentation-facing DTOs and bridge mappers for native hosts while keeping
//   runtime interface contracts host-agnostic and export-friendly.
// - Ensure native presentation layers avoid touching composition, use case, or facade internals directly.
// - Provide stable bridge models for view state, command rendering, and compatibility wrappers.
// - This file can later be split into PresentationModels.swift, ApplePresentationBridge.swift,
//   compatibility adapters, and FFIBridge.swift.

public enum PraxisRuntimePresentationBridgeModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisRuntimePresentationBridge",
    responsibility: "把 runtime facade/use case 映射为原生展示态与兼容包装，不承担 portal-agnostic runtime contract。",
    tsModules: [
      "src/agent_core/live-agent-chat/shared.ts",
      "src/agent_core/live-agent-chat/ui.ts",
    ],
  )

  public static let bootstrap = PraxisRuntimeBlueprint(
    foundationModules: [
      PraxisCoreTypesModule.boundary,
      PraxisGoalModule.boundary,
      PraxisStateModule.boundary,
      PraxisTransitionModule.boundary,
      PraxisRunModule.boundary,
      PraxisSessionModule.boundary,
      PraxisJournalModule.boundary,
      PraxisCheckpointModule.boundary,
    ],
    functionalDomainModules: [
      PraxisCapabilityContractsModule.boundary,
      PraxisCapabilityPlanningModule.boundary,
      PraxisCapabilityResultsModule.boundary,
      PraxisCapabilityCatalogModule.boundary,
      PraxisTapTypesModule.boundary,
      PraxisTapGovernanceModule.boundary,
      PraxisTapReviewModule.boundary,
      PraxisTapProvisionModule.boundary,
      PraxisTapRuntimeModule.boundary,
      PraxisTapAvailabilityModule.boundary,
      PraxisMpTypesModule.boundary,
      PraxisMpSearchModule.boundary,
      PraxisMpMemoryModule.boundary,
      PraxisMpFiveAgentModule.boundary,
      PraxisCmpTypesModule.boundary,
      PraxisCmpSectionsModule.boundary,
      PraxisCmpProjectionModule.boundary,
      PraxisCmpDeliveryModule.boundary,
      PraxisCmpGitModelModule.boundary,
      PraxisCmpDbModelModule.boundary,
      PraxisCmpMqModelModule.boundary,
      PraxisCmpFiveAgentModule.boundary,
    ],
    hostContractModules: [
      PraxisProviderContractsModule.boundary,
      PraxisWorkspaceContractsModule.boundary,
      PraxisToolingContractsModule.boundary,
      PraxisInfraContractsModule.boundary,
      PraxisUserIOContractsModule.boundary,
    ],
    runtimeModules: [
      PraxisRuntimeCompositionModule.boundary,
      PraxisRuntimeUseCasesModule.boundary,
      PraxisRuntimeFacadesModule.boundary,
      PraxisRuntimeInterfaceModule.boundary,
      PraxisRuntimeGatewayModule.boundary,
      boundary,
    ],
    entrypoints: [
      "PraxisCLI",
      "PraxisAppleUI",
      "PraxisFFI",
    ],
    rules: [
      "Core 是逻辑层，不是单一模块。",
      "HostContracts 必须按协议族继续拆分。",
      "HostRuntime 必须按 composition/use case/facade/runtime interface/runtime gateway/presentation bridge 拆分。",
      "CLI / 导出入口优先经由 RuntimeGateway -> RuntimeInterface；原生 UI 展示态通过 RuntimePresentationBridge 进入系统。",
    ],
  )
}
