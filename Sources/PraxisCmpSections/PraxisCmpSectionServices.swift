import PraxisCmpTypes
import PraxisCoreTypes

public struct PraxisSectionBuilder: Sendable {
  public init() {}

  /// Builds an ingress record by converting raw runtime materials into exact sections.
  ///
  /// - Parameters:
  ///   - input: Public CMP ingest input.
  ///   - requestID: Stable request identifier for the ingest.
  ///   - createdAt: Timestamp captured at ingest time.
  /// - Returns: A normalized ingress record that owns one section per runtime material.
  public func buildIngressRecord(
    from input: PraxisIngestRuntimeContextInput,
    requestID: PraxisCmpRequestID,
    createdAt: String
  ) -> PraxisSectionIngressRecord {
    let request = PraxisSectionIngressRequest(
      requestID: requestID,
      lineageID: input.lineage.id,
      taskSummary: input.taskSummary,
      createdAt: createdAt
    )

    let sections = input.materials.enumerated().map { index, material in
      let sectionID = PraxisCmpSectionID(rawValue: "\(requestID.rawValue):section:\(index)")
      return PraxisCmpSection(
        id: sectionID,
        lineageID: input.lineage.id,
        title: "\(material.kind.rawValue) \(index + 1)",
        source: .runtimeMaterial,
        kind: mapSectionKind(from: material.kind),
        fidelity: .exact,
        scope: .local,
        payloadRefs: [material.ref],
        sourceAnchors: [.init(payloadRef: material.ref, label: material.kind.rawValue)],
        metadata: material.metadata
      )
    }

    return PraxisSectionIngressRecord(
      request: request,
      sections: sections,
      requiresActiveSync: input.requiresActiveSync
    )
  }

  /// Lowers ingress sections into stored-section plans using a deterministic rule pack.
  ///
  /// - Parameters:
  ///   - ingress: Ingress record to lower.
  ///   - rulePack: Ownership and lowering rules.
  /// - Returns: Lowering plans for every ingress section, preserving order.
  public func lower(
    _ ingress: PraxisSectionIngressRecord,
    with rulePack: PraxisSectionRulePack
  ) -> [PraxisSectionLoweringPlan] {
    ingress.sections.map { section in
      let evaluations = rulePack.rules.map { rule in
        let scopeAccepted = rule.requiredScope == nil || rule.requiredScope == section.scope
        let kindAccepted = rule.allowedKinds.contains(section.kind)
        return PraxisSectionRuleEvaluation(
          ruleID: rule.ruleID,
          accepted: scopeAccepted && kindAccepted,
          summary: scopeAccepted && kindAccepted ? rule.summary : "Rule \(rule.ruleID) did not match."
        )
      }
      let acceptedRule = zip(rulePack.rules, evaluations).first(where: { $0.1.accepted })?.0
      let storedSection = acceptedRule.map { rule in
        PraxisCmpStoredSection(
          id: "\(section.id.rawValue):\(rule.targetPlane.rawValue)",
          sectionID: section.id,
          plane: rule.targetPlane,
          state: rule.targetState,
          scope: section.scope,
          storedRef: "\(rule.targetPlane.rawValue)://\(section.id.rawValue)",
          metadata: section.metadata
        )
      }
      return PraxisSectionLoweringPlan(
        section: section,
        storedSection: storedSection,
        evaluations: evaluations,
        targetSummary: acceptedRule?.summary ?? "No lowering rule matched."
      )
    }
  }

  /// Builds the default section rule pack used by the Swift CMP core.
  ///
  /// - Returns: A minimal deterministic rule pack that mirrors the TS section-first shape.
  public func defaultRulePack() -> PraxisSectionRulePack {
    PraxisSectionRulePack(rules: [
      .init(
        ruleID: "rule.user-and-tool.to-git",
        ownerRole: "icma",
        summary: "Exact user and tool evidence should first land in git-facing storage.",
        allowedKinds: [.userInput, .assistantOutput, .toolResult, .systemPrompt, .stateMarker],
        requiredScope: .local,
        targetPlane: .git,
        targetState: .candidate
      ),
      .init(
        ruleID: "rule.packages.to-db",
        ownerRole: "dispatcher",
        summary: "Incoming context packages should be ready for DB-side consumption.",
        allowedKinds: [.contextPackage, .compositeSummary],
        targetPlane: .db,
        targetState: .checked
      ),
    ])
  }

  private func mapSectionKind(from materialKind: PraxisCmpContextEventKind) -> PraxisCmpSectionKind {
    switch materialKind {
    case .userInput:
      .userInput
    case .systemPrompt:
      .systemPrompt
    case .assistantOutput:
      .assistantOutput
    case .toolResult:
      .toolResult
    case .stateMarker:
      .stateMarker
    case .contextPackage:
      .contextPackage
    }
  }
}
