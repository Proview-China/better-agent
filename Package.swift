// swift-tools-version: 6.0

import PackageDescription

let foundationTargets = [
  "PraxisCoreTypes",
  "PraxisGoal",
  "PraxisState",
  "PraxisTransition",
  "PraxisRun",
  "PraxisSession",
  "PraxisJournal",
  "PraxisCheckpoint",
]

let capabilityTargets = [
  "PraxisCapabilityContracts",
  "PraxisCapabilityPlanning",
  "PraxisCapabilityResults",
  "PraxisCapabilityCatalog",
]

let tapTargets = [
  "PraxisTapTypes",
  "PraxisTapGovernance",
  "PraxisTapReview",
  "PraxisTapProvision",
  "PraxisTapRuntime",
  "PraxisTapAvailability",
]

let cmpTargets = [
  "PraxisCmpTypes",
  "PraxisCmpSections",
  "PraxisCmpProjection",
  "PraxisCmpDelivery",
  "PraxisCmpGitModel",
  "PraxisCmpDbModel",
  "PraxisCmpMqModel",
  "PraxisCmpFiveAgent",
]

let hostContractTargets = [
  "PraxisProviderContracts",
  "PraxisWorkspaceContracts",
  "PraxisToolingContracts",
  "PraxisInfraContracts",
  "PraxisUserIOContracts",
]

let hostRuntimeTargets = [
  "PraxisRuntimeComposition",
  "PraxisRuntimeUseCases",
  "PraxisRuntimeFacades",
  "PraxisRuntimePresentationBridge",
]

let architectureTestTargets = [
  "PraxisFoundationArchitectureTests",
  "PraxisCapabilityArchitectureTests",
  "PraxisTapArchitectureTests",
  "PraxisCmpArchitectureTests",
  "PraxisHostContractsArchitectureTests",
  "PraxisHostRuntimeArchitectureTests",
]

let appleProducts: [Product]
let appleTargets: [Target]

#if os(macOS)
appleProducts = [
  .library(name: "PraxisAppleUI", targets: ["PraxisAppleUI"]),
]

appleTargets = [
  .target(
    name: "PraxisAppleUI",
    dependencies: [
      "PraxisRuntimePresentationBridge",
    ],
    path: "Sources/PraxisAppleUI",
  ),
]
#else
appleProducts = []
appleTargets = []
#endif

let package = Package(
  name: "Praxis",
  platforms: [
    .macOS(.v14),
    .iOS(.v17),
    .tvOS(.v17),
    .watchOS(.v10),
    .visionOS(.v1),
  ],
  products: [
    .library(name: "PraxisFoundation", targets: foundationTargets),
    .library(name: "PraxisCapabilityDomain", targets: capabilityTargets),
    .library(name: "PraxisTapDomain", targets: tapTargets),
    .library(name: "PraxisCmpDomain", targets: cmpTargets),
    .library(name: "PraxisHostContracts", targets: hostContractTargets),
    .library(name: "PraxisHostRuntime", targets: hostRuntimeTargets),
    .library(name: "PraxisArchitectureTests", targets: architectureTestTargets),
    .executable(name: "praxis-cli", targets: ["PraxisCLI"]),
  ] + appleProducts,
  targets: [
    .target(
      name: "PraxisCoreTypes",
      path: "Sources/PraxisCoreTypes",
    ),
    .target(
      name: "PraxisGoal",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisGoal",
    ),
    .target(
      name: "PraxisState",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisState",
    ),
    .target(
      name: "PraxisTransition",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisState",
      ],
      path: "Sources/PraxisTransition",
    ),
    .target(
      name: "PraxisRun",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisState",
        "PraxisTransition",
      ],
      path: "Sources/PraxisRun",
    ),
    .target(
      name: "PraxisSession",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisSession",
    ),
    .target(
      name: "PraxisJournal",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisSession",
      ],
      path: "Sources/PraxisJournal",
    ),
    .target(
      name: "PraxisCheckpoint",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisSession",
        "PraxisJournal",
      ],
      path: "Sources/PraxisCheckpoint",
    ),
    .target(
      name: "PraxisCapabilityContracts",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisCapabilityContracts",
    ),
    .target(
      name: "PraxisCapabilityPlanning",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisGoal",
        "PraxisRun",
        "PraxisCapabilityContracts",
      ],
      path: "Sources/PraxisCapabilityPlanning",
    ),
    .target(
      name: "PraxisCapabilityResults",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
      ],
      path: "Sources/PraxisCapabilityResults",
    ),
    .target(
      name: "PraxisCapabilityCatalog",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
      ],
      path: "Sources/PraxisCapabilityCatalog",
    ),
    .target(
      name: "PraxisTapTypes",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
      ],
      path: "Sources/PraxisTapTypes",
    ),
    .target(
      name: "PraxisTapGovernance",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisTapTypes",
      ],
      path: "Sources/PraxisTapGovernance",
    ),
    .target(
      name: "PraxisTapReview",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisCapabilityResults",
        "PraxisTapTypes",
        "PraxisTapGovernance",
      ],
      path: "Sources/PraxisTapReview",
    ),
    .target(
      name: "PraxisTapProvision",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
        "PraxisTapTypes",
        "PraxisTapGovernance",
      ],
      path: "Sources/PraxisTapProvision",
    ),
    .target(
      name: "PraxisTapRuntime",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisSession",
        "PraxisCheckpoint",
        "PraxisCapabilityPlanning",
        "PraxisTapTypes",
        "PraxisTapGovernance",
        "PraxisTapReview",
        "PraxisTapProvision",
      ],
      path: "Sources/PraxisTapRuntime",
    ),
    .target(
      name: "PraxisTapAvailability",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityCatalog",
        "PraxisTapTypes",
        "PraxisTapGovernance",
      ],
      path: "Sources/PraxisTapAvailability",
    ),
    .target(
      name: "PraxisCmpTypes",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisCmpTypes",
    ),
    .target(
      name: "PraxisCmpSections",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCmpTypes",
      ],
      path: "Sources/PraxisCmpSections",
    ),
    .target(
      name: "PraxisCmpProjection",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCheckpoint",
        "PraxisCmpTypes",
        "PraxisCmpSections",
      ],
      path: "Sources/PraxisCmpProjection",
    ),
    .target(
      name: "PraxisCmpDelivery",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityPlanning",
        "PraxisTapTypes",
        "PraxisCmpTypes",
        "PraxisCmpProjection",
      ],
      path: "Sources/PraxisCmpDelivery",
    ),
    .target(
      name: "PraxisCmpGitModel",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCmpTypes",
        "PraxisCmpProjection",
      ],
      path: "Sources/PraxisCmpGitModel",
    ),
    .target(
      name: "PraxisCmpDbModel",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCmpTypes",
        "PraxisCmpProjection",
      ],
      path: "Sources/PraxisCmpDbModel",
    ),
    .target(
      name: "PraxisCmpMqModel",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCmpTypes",
        "PraxisCmpDelivery",
      ],
      path: "Sources/PraxisCmpMqModel",
    ),
    .target(
      name: "PraxisCmpFiveAgent",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityPlanning",
        "PraxisTapReview",
        "PraxisTapRuntime",
        "PraxisCmpTypes",
        "PraxisCmpSections",
        "PraxisCmpProjection",
        "PraxisCmpDelivery",
      ],
      path: "Sources/PraxisCmpFiveAgent",
    ),
    .target(
      name: "PraxisProviderContracts",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisCapabilityResults",
      ],
      path: "Sources/PraxisProviderContracts",
    ),
    .target(
      name: "PraxisWorkspaceContracts",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisWorkspaceContracts",
    ),
    .target(
      name: "PraxisToolingContracts",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisToolingContracts",
    ),
    .target(
      name: "PraxisInfraContracts",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCmpTypes",
        "PraxisCmpDelivery",
      ],
      path: "Sources/PraxisInfraContracts",
    ),
    .target(
      name: "PraxisUserIOContracts",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisUserIOContracts",
    ),
    .target(
      name: "PraxisRuntimeComposition",
      dependencies: [
        "PraxisGoal",
        "PraxisState",
        "PraxisTransition",
        "PraxisRun",
        "PraxisSession",
        "PraxisJournal",
        "PraxisCheckpoint",
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
        "PraxisCapabilityResults",
        "PraxisCapabilityCatalog",
        "PraxisTapTypes",
        "PraxisTapGovernance",
        "PraxisTapReview",
        "PraxisTapProvision",
        "PraxisTapRuntime",
        "PraxisTapAvailability",
        "PraxisCmpTypes",
        "PraxisCmpSections",
        "PraxisCmpProjection",
        "PraxisCmpDelivery",
        "PraxisCmpGitModel",
        "PraxisCmpDbModel",
        "PraxisCmpMqModel",
        "PraxisCmpFiveAgent",
        "PraxisProviderContracts",
        "PraxisWorkspaceContracts",
        "PraxisToolingContracts",
        "PraxisInfraContracts",
        "PraxisUserIOContracts",
      ],
      path: "Sources/PraxisRuntimeComposition",
    ),
    .target(
      name: "PraxisRuntimeUseCases",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisRuntimeComposition",
        "PraxisTapTypes",
        "PraxisTapGovernance",
        "PraxisTapReview",
        "PraxisTapRuntime",
      ],
      path: "Sources/PraxisRuntimeUseCases",
    ),
    .target(
      name: "PraxisRuntimeFacades",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisRuntimeUseCases",
      ],
      path: "Sources/PraxisRuntimeFacades",
    ),
    .target(
      name: "PraxisRuntimePresentationBridge",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisGoal",
        "PraxisState",
        "PraxisTransition",
        "PraxisRun",
        "PraxisSession",
        "PraxisJournal",
        "PraxisCheckpoint",
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
        "PraxisCapabilityResults",
        "PraxisCapabilityCatalog",
        "PraxisTapTypes",
        "PraxisTapGovernance",
        "PraxisTapReview",
        "PraxisTapProvision",
        "PraxisTapRuntime",
        "PraxisTapAvailability",
        "PraxisCmpTypes",
        "PraxisCmpSections",
        "PraxisCmpProjection",
        "PraxisCmpDelivery",
        "PraxisCmpGitModel",
        "PraxisCmpDbModel",
        "PraxisCmpMqModel",
        "PraxisCmpFiveAgent",
        "PraxisProviderContracts",
        "PraxisWorkspaceContracts",
        "PraxisToolingContracts",
        "PraxisInfraContracts",
        "PraxisUserIOContracts",
        "PraxisRuntimeComposition",
        "PraxisRuntimeUseCases",
        "PraxisRuntimeFacades",
      ],
      path: "Sources/PraxisRuntimePresentationBridge",
    ),
    .executableTarget(
      name: "PraxisCLI",
      dependencies: [
        "PraxisRuntimePresentationBridge",
      ],
      path: "Sources/PraxisCLI",
    ),
    .testTarget(
      name: "PraxisFoundationArchitectureTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisGoal",
        "PraxisState",
        "PraxisTransition",
        "PraxisRun",
        "PraxisSession",
        "PraxisJournal",
        "PraxisCheckpoint",
      ],
      path: "Tests/PraxisFoundationArchitectureTests",
    ),
    .testTarget(
      name: "PraxisGoalTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisGoal",
      ],
      path: "Tests/PraxisGoalTests",
    ),
    .testTarget(
      name: "PraxisStateTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisState",
      ],
      path: "Tests/PraxisStateTests",
    ),
    .testTarget(
      name: "PraxisTransitionTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisState",
        "PraxisTransition",
      ],
      path: "Tests/PraxisTransitionTests",
    ),
    .testTarget(
      name: "PraxisRunTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisState",
        "PraxisTransition",
        "PraxisRun",
      ],
      path: "Tests/PraxisRunTests",
    ),
    .testTarget(
      name: "PraxisSessionTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisSession",
      ],
      path: "Tests/PraxisSessionTests",
    ),
    .testTarget(
      name: "PraxisJournalTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisSession",
        "PraxisJournal",
      ],
      path: "Tests/PraxisJournalTests",
    ),
    .testTarget(
      name: "PraxisCheckpointTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisSession",
        "PraxisJournal",
        "PraxisCheckpoint",
      ],
      path: "Tests/PraxisCheckpointTests",
    ),
    .testTarget(
      name: "PraxisCapabilityArchitectureTests",
      dependencies: [
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
        "PraxisCapabilityResults",
        "PraxisCapabilityCatalog",
      ],
      path: "Tests/PraxisCapabilityArchitectureTests",
    ),
    .testTarget(
      name: "PraxisTapArchitectureTests",
      dependencies: [
        "PraxisTapTypes",
        "PraxisTapGovernance",
        "PraxisTapReview",
        "PraxisTapProvision",
        "PraxisTapRuntime",
        "PraxisTapAvailability",
      ],
      path: "Tests/PraxisTapArchitectureTests",
    ),
    .testTarget(
      name: "PraxisCmpArchitectureTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpSections",
        "PraxisCmpProjection",
        "PraxisCmpDelivery",
        "PraxisCmpGitModel",
        "PraxisCmpDbModel",
        "PraxisCmpMqModel",
        "PraxisCmpFiveAgent",
      ],
      path: "Tests/PraxisCmpArchitectureTests",
    ),
    .testTarget(
      name: "PraxisHostContractsArchitectureTests",
      dependencies: [
        "PraxisProviderContracts",
        "PraxisWorkspaceContracts",
        "PraxisToolingContracts",
        "PraxisInfraContracts",
        "PraxisUserIOContracts",
      ],
      path: "Tests/PraxisHostContractsArchitectureTests",
    ),
    .testTarget(
      name: "PraxisHostRuntimeArchitectureTests",
      dependencies: [
        "PraxisRuntimeComposition",
        "PraxisRuntimeUseCases",
        "PraxisRuntimeFacades",
        "PraxisRuntimePresentationBridge",
      ],
      path: "Tests/PraxisHostRuntimeArchitectureTests",
    ),
  ] + appleTargets,
)
