import PraxisCapabilityContracts
import PraxisCapabilityPlanning
import PraxisRuntimeComposition
import PraxisTapGovernance
import PraxisTapReview
import PraxisTapRuntime
import PraxisTapTypes
import PraxisRun
import PraxisSession

public final class PraxisRunGoalUseCase: PraxisRunGoalUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisRunGoalCommand) async throws -> PraxisRunID {
    if let sessionID = command.sessionID {
      return PraxisRunID(rawValue: "run.\(sessionID.rawValue).\(command.goal.normalizedGoal.id.rawValue)")
    }
    return PraxisRunID(rawValue: "run.\(command.goal.normalizedGoal.id.rawValue)")
  }
}

public final class PraxisResumeRunUseCase: PraxisResumeRunUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute(_ command: PraxisResumeRunCommand) async throws -> PraxisRunID {
    command.runID
  }
}

public final class PraxisInspectTapUseCase: PraxisInspectTapUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute() async throws -> PraxisTapInspection {
    let governance = PraxisTapGovernanceObject(
      mode: .careful,
      riskLevel: .medium,
      capabilityIDs: [
        PraxisCapabilityID(rawValue: "workspace.read"),
        PraxisCapabilityID(rawValue: "tool.shell"),
      ]
    )
    let governanceSnapshot = PraxisGovernanceSnapshot(
      governance: governance,
      summary: "当前 TAP 占位接入面已经包含 governance/context/tool-review/runtime 四层骨架。"
    )
    let reviewContext = PraxisReviewContextAperture(
      projectSummary: .init(summary: "Swift skeleton integration in progress", status: .ready, source: "usecase"),
      runSummary: .init(summary: "tap inspection placeholder", status: .ready, source: "usecase"),
      userIntentSummary: .init(summary: "Inspect TAP integration surface", status: .ready, source: "usecase"),
      inventorySnapshot: .init(
        totalCapabilities: governance.capabilityIDs.count,
        availableCapabilityIDs: governance.capabilityIDs
      ),
      riskSummary: .init(
        requestedAction: "Connect TAP placeholder flow",
        riskLevel: .medium,
        plainLanguageSummary: "这是占位接入，不会真正触发工具或 provider。",
        whyItIsRisky: "结构会影响后续真实实现的落点。",
        possibleConsequence: "如果边界命名不稳，后面实现会返工。",
        whatHappensIfNotRun: "TAP 的宿主通路仍然只能停留在注释层。",
        availableUserActions: [
          .init(actionID: "continue", label: "继续接入", summary: "先固定 bridge 和 facade 通路")
        ]
      ),
      sections: [
        .init(
          sectionID: "tap-bridge",
          title: "TAP bridge",
          summary: "UseCase 可生成结构化 TAP inspection。",
          status: .ready,
          freshness: .fresh,
          trustLevel: .verified
        )
      ],
      forbiddenObjects: [
        .init(kind: .runtimeHandle, summary: "真正的 live runtime handle 仍不进入 governance aperture。")
      ],
      mode: governance.mode
    )
    let toolReviewReport = PraxisToolReviewReport(
      session: .init(
        sessionID: "tap-tool-review.placeholder",
        status: .open,
        actions: [
          .init(
            reviewID: "review.placeholder",
            sessionID: "tap-tool-review.placeholder",
            governanceKind: .activation,
            capabilityID: governance.capabilityIDs.last,
            status: .recorded,
            summary: "当前只是占位治理记录，还没有真实 handoff。",
            recordedAt: "2026-04-10T12:00:00Z"
          )
        ]
      ),
      latestDecision: .init(route: .toolReview, summary: "危险或高副作用能力仍走 tool review 面。"),
      latestResult: nil,
      signals: [
        .init(kind: "recorded_only", active: true, summary: "目前只记录治理证据，不执行真正 runtime handoff。")
      ],
      advisories: [
        .init(code: "placeholder_only", severity: .medium, summary: "UseCase 已接通，但还未接入真实 provider/tool runtime。")
      ]
    )
    let runtimeSnapshot = PraxisTapRuntimeSnapshot(
      controlPlaneState: .init(
        sessionID: PraxisSessionID(rawValue: "tap.session.placeholder"),
        governance: governance,
        humanGateState: .notRequired
      ),
      checkpointPointer: nil
    )
    return PraxisTapInspection(
      summary: "TAP inspection placeholder is now wired through use cases.",
      governanceSnapshot: governanceSnapshot,
      reviewContext: reviewContext,
      toolReviewReport: toolReviewReport,
      runtimeSnapshot: runtimeSnapshot
    )
  }
}

public final class PraxisInspectCmpUseCase: PraxisInspectCmpUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute() async throws -> PraxisCmpInspection {
    let runtimeProfile = PraxisCmpLocalRuntimeProfile(
      structuredStoreSummary: "SQLite-backed projection, checkpoint, and journal storage is the default macOS host assumption.",
      deliveryStoreSummary: "Delivery truth is expected to persist locally instead of relying on Redis.",
      messageBusSummary: "Neighborhood fan-out should stay inside an in-process actor message bus until multi-process needs appear.",
      gitSummary: "System git remains an on-demand host tool and may trigger Command Line Tools installation when first invoked.",
      semanticIndexSummary: "Semantic search should stay local-first, with SQLite metadata plus Accelerate similarity execution."
    )
    let issues = [
      "CMP local runtime profile is placeholder only and still needs concrete SQLite/message-bus implementations.",
      "System git readiness and semantic index execution still need live host adapters.",
    ]
    return PraxisCmpInspection(
      runtimeProfile: runtimeProfile,
      summary: "CMP inspection now assumes a macOS-local runtime profile.",
      projectID: "cmp.placeholder",
      issues: issues,
      hostSummary: "macOS local runtime / SQLite / actor message bus / system git / Accelerate"
    )
  }
}

public final class PraxisBuildCapabilityCatalogUseCase: PraxisBuildCapabilityCatalogUseCaseProtocol {
  public let dependencies: PraxisDependencyGraph

  public init(dependencies: PraxisDependencyGraph) {
    self.dependencies = dependencies
  }

  public func execute() async throws -> String {
    let boundaryNames = dependencies.boundaries.map(\.name).joined(separator: ", ")
    return "Capability catalog placeholder assembled from current boundaries: \(boundaryNames)"
  }
}
