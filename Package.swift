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

let mpTargets = [
  "PraxisMpTypes",
  "PraxisMpSearch",
  "PraxisMpMemory",
  "PraxisMpFiveAgent",
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
  "PraxisRuntimeInterface",
  "PraxisRuntimeGateway",
  "PraxisFFI",
]

let architectureTestTargets = [
  "PraxisFoundationArchitectureTests",
  "PraxisCapabilityArchitectureTests",
  "PraxisTapArchitectureTests",
  "PraxisCmpArchitectureTests",
  "PraxisHostContractsArchitectureTests",
  "PraxisHostRuntimeArchitectureTests",
]

let sqliteSystemLibraryTargets: [Target]
let sqliteRuntimeDependencies: [Target.Dependency]

#if os(macOS)
sqliteSystemLibraryTargets = []
sqliteRuntimeDependencies = []
#else
sqliteSystemLibraryTargets = [
  .systemLibrary(
    name: "SQLite3",
    path: "Sources/SQLite3",
    pkgConfig: "sqlite3",
    providers: [
      .apt(["libsqlite3-dev"]),
      .brew(["sqlite3"]),
    ],
  )
]
sqliteRuntimeDependencies = [
  "SQLite3",
]
#endif

let hostRuntimeArchitectureTestsTarget: Target
hostRuntimeArchitectureTestsTarget = .testTarget(
  name: "PraxisHostRuntimeArchitectureTests",
  dependencies: [
    "PraxisRuntimeComposition",
    "PraxisRuntimeUseCases",
    "PraxisRuntimeFacades",
    "PraxisRuntimeInterface",
    "PraxisFFI",
    "PraxisRuntimeKit",
    "PraxisMpTypes",
  ],
  path: "Tests/PraxisHostRuntimeArchitectureTests",
)

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
    .library(name: "PraxisMpDomain", targets: mpTargets),
    .library(name: "PraxisHostContracts", targets: hostContractTargets),
    .library(name: "PraxisHostRuntime", targets: hostRuntimeTargets),
    .library(name: "PraxisRuntimeKit", targets: ["PraxisRuntimeKit"]),
    .library(name: "PraxisArchitectureTests", targets: architectureTestTargets),
    .executable(name: "PraxisRuntimeKitSmoke", targets: ["PraxisRuntimeKitSmoke"]),
    .executable(name: "PraxisRuntimeKitRunExample", targets: ["PraxisRuntimeKitRunExample"]),
    .executable(name: "PraxisRuntimeKitCmpTapExample", targets: ["PraxisRuntimeKitCmpTapExample"]),
    .executable(name: "PraxisRuntimeKitMpExample", targets: ["PraxisRuntimeKitMpExample"]),
    .executable(name: "PraxisRuntimeKitCapabilitiesExample", targets: ["PraxisRuntimeKitCapabilitiesExample"]),
    .executable(name: "PraxisRuntimeKitGovernedExecutionExample", targets: ["PraxisRuntimeKitGovernedExecutionExample"]),
    .executable(name: "PraxisRuntimeKitSearchExample", targets: ["PraxisRuntimeKitSearchExample"]),
    .executable(name: "PraxisRuntimeKitDurableRuntimeExample", targets: ["PraxisRuntimeKitDurableRuntimeExample"]),
    .executable(name: "PraxisFFIEmbeddingExample", targets: ["PraxisFFIEmbeddingExample"]),
    .executable(name: "PraxisAppleHostEmbeddingExample", targets: ["PraxisAppleHostEmbeddingExample"]),
    .executable(name: "PraxisDemoHostApp", targets: ["PraxisDemoHostApp"]),
    .executable(name: "PraxisExportBaselineExample", targets: ["PraxisExportBaselineExample"]),
  ],
  targets: sqliteSystemLibraryTargets + [
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
      name: "PraxisMpTypes",
      dependencies: [
        "PraxisCoreTypes",
      ],
      path: "Sources/PraxisMpTypes",
    ),
    .target(
      name: "PraxisMpSearch",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisMpTypes",
      ],
      path: "Sources/PraxisMpSearch",
    ),
    .target(
      name: "PraxisMpMemory",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisMpTypes",
      ],
      path: "Sources/PraxisMpMemory",
    ),
    .target(
      name: "PraxisMpFiveAgent",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisMpTypes",
        "PraxisMpSearch",
        "PraxisMpMemory",
      ],
      path: "Sources/PraxisMpFiveAgent",
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
        "PraxisSession",
        "PraxisJournal",
        "PraxisCheckpoint",
        "PraxisCmpTypes",
        "PraxisCmpDelivery",
        "PraxisMpTypes",
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
      dependencies: sqliteRuntimeDependencies + [
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
        "PraxisMpTypes",
        "PraxisMpSearch",
        "PraxisMpMemory",
        "PraxisMpFiveAgent",
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
        "PraxisCmpDelivery",
        "PraxisCmpDbModel",
        "PraxisCmpFiveAgent",
        "PraxisCmpGitModel",
        "PraxisCmpMqModel",
        "PraxisCmpProjection",
        "PraxisCmpSections",
        "PraxisCmpTypes",
        "PraxisMpTypes",
        "PraxisMpSearch",
        "PraxisMpMemory",
        "PraxisMpFiveAgent",
        "PraxisRuntimeComposition",
        "PraxisTapTypes",
        "PraxisTapGovernance",
        "PraxisTapProvision",
        "PraxisTapReview",
        "PraxisTapRuntime",
      ],
      path: "Sources/PraxisRuntimeUseCases",
    ),
    .target(
      name: "PraxisRuntimeFacades",
      dependencies: [
        "PraxisCapabilityCatalog",
        "PraxisCapabilityContracts",
        "PraxisCapabilityResults",
        "PraxisCoreTypes",
        "PraxisProviderContracts",
        "PraxisTapProvision",
        "PraxisTapRuntime",
        "PraxisRuntimeComposition",
        "PraxisRuntimeUseCases",
        "PraxisSession",
      ],
      path: "Sources/PraxisRuntimeFacades",
    ),
    .target(
      name: "PraxisRuntimeInterface",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCoreTypes",
        "PraxisGoal",
        "PraxisMpTypes",
        "PraxisRun",
        "PraxisSession",
        "PraxisRuntimeFacades",
      ],
      path: "Sources/PraxisRuntimeInterface",
    ),
    .target(
      name: "PraxisRuntimeGateway",
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
        "PraxisMpTypes",
        "PraxisMpSearch",
        "PraxisMpMemory",
        "PraxisMpFiveAgent",
        "PraxisProviderContracts",
        "PraxisWorkspaceContracts",
        "PraxisToolingContracts",
        "PraxisInfraContracts",
        "PraxisUserIOContracts",
        "PraxisRuntimeComposition",
        "PraxisRuntimeUseCases",
        "PraxisRuntimeFacades",
        "PraxisRuntimeInterface",
      ],
      path: "Sources/PraxisRuntimeGateway",
    ),
    .target(
      name: "PraxisFFI",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisRuntimeGateway",
        "PraxisRuntimeInterface",
      ],
      path: "Sources/PraxisFFI",
    ),
    .target(
      name: "PraxisRuntimeKit",
      dependencies: [
        "PraxisCapabilityCatalog",
        "PraxisCapabilityContracts",
        "PraxisCmpTypes",
        "PraxisCoreTypes",
        "PraxisGoal",
        "PraxisMpTypes",
        "PraxisProviderContracts",
        "PraxisSession",
        "PraxisTapProvision",
        "PraxisTapRuntime",
        "PraxisTapTypes",
        "PraxisRuntimeFacades",
        "PraxisRuntimeGateway",
      ],
      path: "Sources/PraxisRuntimeKit",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitCapabilitiesExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitCapabilitiesExample",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitGovernedExecutionExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitGovernedExecutionExample",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitSearchExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitSearchExample",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitDurableRuntimeExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitDurableRuntimeExample",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitSmoke",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitSmoke",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitRunExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitRunExample",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitCmpTapExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitCmpTapExample",
    ),
    .executableTarget(
      name: "PraxisRuntimeKitMpExample",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Examples/PraxisRuntimeKitMpExample",
    ),
    .executableTarget(
      name: "PraxisFFIEmbeddingExample",
      dependencies: [
        "PraxisFFI",
        "PraxisRuntimeInterface",
      ],
      path: "Examples/PraxisFFIEmbeddingExample",
    ),
    .executableTarget(
      name: "PraxisAppleHostEmbeddingExample",
      dependencies: [
        "PraxisFFI",
        "PraxisRuntimeInterface",
      ],
      path: "Examples/PraxisAppleHostEmbeddingExample",
    ),
    .executableTarget(
      name: "PraxisDemoHostApp",
      dependencies: [
        "PraxisFFI",
        "PraxisRuntimeInterface",
      ],
      path: "Examples/PraxisDemoHostApp",
    ),
    .executableTarget(
      name: "PraxisExportBaselineExample",
      dependencies: [
        "PraxisFFI",
        "PraxisRuntimeInterface",
      ],
      path: "Examples/PraxisExportBaselineExample",
    ),
    .testTarget(
      name: "PraxisDemoHostAppTests",
      dependencies: [
        "PraxisDemoHostApp",
      ],
      path: "Tests/PraxisDemoHostAppTests",
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
      name: "PraxisCapabilityContractsTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
      ],
      path: "Tests/PraxisCapabilityContractsTests",
    ),
    .testTarget(
      name: "PraxisCapabilityResultsTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisCapabilityResults",
      ],
      path: "Tests/PraxisCapabilityResultsTests",
    ),
    .testTarget(
      name: "PraxisCapabilityPlanningTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisGoal",
        "PraxisRun",
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
      ],
      path: "Tests/PraxisCapabilityPlanningTests",
    ),
    .testTarget(
      name: "PraxisCapabilityCatalogTests",
      dependencies: [
        "PraxisCoreTypes",
        "PraxisCapabilityContracts",
        "PraxisCapabilityPlanning",
        "PraxisCapabilityCatalog",
      ],
      path: "Tests/PraxisCapabilityCatalogTests",
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
      name: "PraxisTapGovernanceTests",
      dependencies: [
        "PraxisTapGovernance",
        "PraxisTapTypes",
      ],
      path: "Tests/PraxisTapGovernanceTests",
    ),
    .testTarget(
      name: "PraxisTapReviewTests",
      dependencies: [
        "PraxisTapReview",
        "PraxisTapGovernance",
        "PraxisTapTypes",
        "PraxisCapabilityContracts",
      ],
      path: "Tests/PraxisTapReviewTests",
    ),
    .testTarget(
      name: "PraxisTapProvisionTests",
      dependencies: [
        "PraxisTapProvision",
        "PraxisTapTypes",
        "PraxisCapabilityContracts",
      ],
      path: "Tests/PraxisTapProvisionTests",
    ),
    .testTarget(
      name: "PraxisTapRuntimeTests",
      dependencies: [
        "PraxisTapRuntime",
        "PraxisTapGovernance",
        "PraxisTapProvision",
        "PraxisTapTypes",
        "PraxisSession",
      ],
      path: "Tests/PraxisTapRuntimeTests",
    ),
    .testTarget(
      name: "PraxisTapAvailabilityTests",
      dependencies: [
        "PraxisTapAvailability",
        "PraxisTapGovernance",
        "PraxisTapTypes",
        "PraxisCapabilityContracts",
      ],
      path: "Tests/PraxisTapAvailabilityTests",
    ),
    .testTarget(
      name: "PraxisCmpTypesTests",
      dependencies: [
        "PraxisCmpTypes",
      ],
      path: "Tests/PraxisCmpTypesTests",
    ),
    .testTarget(
      name: "PraxisCmpSectionsTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpSections",
      ],
      path: "Tests/PraxisCmpSectionsTests",
    ),
    .testTarget(
      name: "PraxisCmpProjectionTests",
      dependencies: [
        "PraxisCheckpoint",
        "PraxisCmpTypes",
        "PraxisCmpSections",
        "PraxisCmpProjection",
      ],
      path: "Tests/PraxisCmpProjectionTests",
    ),
    .testTarget(
      name: "PraxisCmpDeliveryTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpProjection",
        "PraxisCmpDelivery",
      ],
      path: "Tests/PraxisCmpDeliveryTests",
    ),
    .testTarget(
      name: "PraxisCmpGitModelTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpProjection",
        "PraxisCmpGitModel",
      ],
      path: "Tests/PraxisCmpGitModelTests",
    ),
    .testTarget(
      name: "PraxisCmpDbModelTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpProjection",
        "PraxisCmpDbModel",
      ],
      path: "Tests/PraxisCmpDbModelTests",
    ),
    .testTarget(
      name: "PraxisCmpMqModelTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpDelivery",
        "PraxisCmpMqModel",
      ],
      path: "Tests/PraxisCmpMqModelTests",
    ),
    .testTarget(
      name: "PraxisCmpFiveAgentTests",
      dependencies: [
        "PraxisCmpTypes",
        "PraxisCmpSections",
        "PraxisCmpProjection",
        "PraxisCmpDelivery",
        "PraxisCmpFiveAgent",
      ],
      path: "Tests/PraxisCmpFiveAgentTests",
    ),
    .testTarget(
      name: "PraxisMpTypesTests",
      dependencies: [
        "PraxisMpTypes",
      ],
      path: "Tests/PraxisMpTypesTests",
    ),
    .testTarget(
      name: "PraxisMpSearchTests",
      dependencies: [
        "PraxisMpTypes",
        "PraxisMpSearch",
      ],
      path: "Tests/PraxisMpSearchTests",
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
      name: "PraxisInfraContractsTests",
      dependencies: [
        "PraxisInfraContracts",
        "PraxisSession",
        "PraxisJournal",
        "PraxisCheckpoint",
        "PraxisCmpTypes",
      ],
      path: "Tests/PraxisInfraContractsTests",
    ),
    .testTarget(
      name: "PraxisToolingContractsTests",
      dependencies: [
        "PraxisToolingContracts",
      ],
      path: "Tests/PraxisToolingContractsTests",
    ),
    .testTarget(
      name: "PraxisWorkspaceContractsTests",
      dependencies: [
        "PraxisWorkspaceContracts",
      ],
      path: "Tests/PraxisWorkspaceContractsTests",
    ),
    .testTarget(
      name: "PraxisUserIOContractsTests",
      dependencies: [
        "PraxisUserIOContracts",
      ],
      path: "Tests/PraxisUserIOContractsTests",
    ),
    .testTarget(
      name: "PraxisProviderContractsTests",
      dependencies: [
        "PraxisProviderContracts",
        "PraxisCapabilityResults",
      ],
      path: "Tests/PraxisProviderContractsTests",
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
    hostRuntimeArchitectureTestsTarget,
    .testTarget(
      name: "PraxisRuntimeKitTests",
      dependencies: [
        "PraxisRuntimeKit",
      ],
      path: "Tests/PraxisRuntimeKitTests",
    ),
    .testTarget(
      name: "PraxisRuntimeFacadesTests",
      dependencies: [
        "PraxisCapabilityResults",
        "PraxisCmpTypes",
        "PraxisInfraContracts",
        "PraxisToolingContracts",
        "PraxisProviderContracts",
        "PraxisRuntimeComposition",
        "PraxisRuntimeFacades",
        "PraxisRuntimeGateway",
        "PraxisMpTypes",
        "PraxisRuntimeUseCases",
        "PraxisTapTypes",
      ],
      path: "Tests/PraxisRuntimeFacadesTests",
    ),
    .testTarget(
      name: "PraxisRuntimeUseCasesTests",
      dependencies: [
        "PraxisCapabilityResults",
        "PraxisCmpTypes",
        "PraxisInfraContracts",
        "PraxisToolingContracts",
        "PraxisProviderContracts",
        "PraxisMpTypes",
        "PraxisRuntimeComposition",
        "PraxisRuntimeGateway",
        "PraxisRuntimeUseCases",
        "PraxisTapTypes",
      ],
      path: "Tests/PraxisRuntimeUseCasesTests",
    ),
    .testTarget(
      name: "PraxisMpMemoryTests",
      dependencies: [
        "PraxisMpTypes",
        "PraxisMpMemory",
      ],
      path: "Tests/PraxisMpMemoryTests",
    ),
    .testTarget(
      name: "PraxisMpFiveAgentTests",
      dependencies: [
        "PraxisMpTypes",
        "PraxisMpSearch",
        "PraxisMpMemory",
        "PraxisMpFiveAgent",
      ],
      path: "Tests/PraxisMpFiveAgentTests",
    ),
  ],
)
