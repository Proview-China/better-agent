import PraxisCmpDelivery
import PraxisCmpTypes

public struct PraxisCmpMqPlanner: Sendable {
  public init() {}

  /// Builds a compact neighborhood graph from a lineage.
  ///
  /// - Parameter lineage: Lineage whose neighborhood should be exposed.
  /// - Returns: A compact neighborhood graph.
  public func neighborhoodGraph(for lineage: PraxisCmpAgentLineage) -> PraxisNeighborhoodGraph {
    PraxisNeighborhoodGraph(
      nodes: [lineage.agentID] + lineage.childAgentIDs + lineage.peerAgentIDs + [lineage.parentAgentID].compactMap { $0 },
      edges: [
        lineage.agentID: lineage.childAgentIDs + lineage.peerAgentIDs + [lineage.parentAgentID].compactMap { $0 },
      ]
    )
  }

  /// Builds a topic topology for a target relation.
  ///
  /// - Parameters:
  ///   - projectID: Project that owns the topology.
  ///   - agentID: Agent that publishes into the topic.
  ///   - relation: Target relation represented by the topic.
  /// - Returns: A topic topology descriptor.
  public func topicTopology(
    projectID: String,
    agentID: String,
    relation: PraxisCmpNeighborhoodRelation
  ) -> PraxisTopicTopology {
    let channel: PraxisCmpMqChannelKind
    switch relation {
    case .same:
      channel = .local
    case .parent:
      channel = .toParent
    case .peer:
      channel = .peer
    case .child:
      channel = .toChildren
    }
    return PraxisTopicTopology(
      projectID: projectID,
      agentID: agentID,
      channel: channel,
      topicName: "cmp.\(projectID).\(agentID).\(relation.rawValue)",
      neighborhoods: [relation]
    )
  }

  /// Builds a routing plan from delivery instructions.
  ///
  /// - Parameters:
  ///   - deliveryPlan: Delivery plan to route.
  ///   - projectID: Project that owns the routing plan.
  /// - Returns: A routing plan with topic descriptors.
  public func routingPlan(
    for deliveryPlan: PraxisDeliveryPlan,
    projectID: String
  ) -> PraxisRoutingPlan {
    let topics = deliveryPlan.instructions.map { instruction in
      topicTopology(projectID: projectID, agentID: instruction.sourceAgentID, relation: mapRelation(instruction.targetKind))
    }
    return PraxisRoutingPlan(deliveryPlan: deliveryPlan, destinationTopics: topics)
  }

  /// Validates that a subscription request respects the lineage relation.
  ///
  /// - Parameters:
  ///   - source: Publishing lineage.
  ///   - target: Subscribing lineage.
  ///   - relation: Requested subscription relation.
  /// - Throws: An error when the requested relation bypasses CMP rules.
  public func validateSubscription(
    source: PraxisCmpAgentLineage,
    target: PraxisCmpAgentLineage,
    relation: PraxisCmpNeighborhoodRelation
  ) throws {
    switch relation {
    case .parent:
      guard source.parentAgentID == target.agentID else {
        throw PraxisCmpValidationError.invalid("CMP MQ parent subscription requires the direct parent.")
      }
    case .peer:
      guard source.parentAgentID != nil,
            source.parentAgentID == target.parentAgentID,
            source.agentID != target.agentID else {
        throw PraxisCmpValidationError.invalid("CMP MQ peer subscription requires siblings under the same parent.")
      }
    case .child:
      guard source.childAgentIDs.contains(target.agentID) else {
        throw PraxisCmpValidationError.invalid("CMP MQ child subscription requires a direct child.")
      }
    case .same:
      guard source.agentID == target.agentID else {
        throw PraxisCmpValidationError.invalid("CMP MQ self subscription requires the same lineage.")
      }
    }
  }

  /// Builds a critical escalation plan for a source lineage.
  ///
  /// - Parameters:
  ///   - source: Source lineage.
  ///   - targetAncestorID: Ancestor that should receive the escalation.
  ///   - reason: Human-readable escalation reason.
  /// - Returns: A critical escalation plan.
  public func criticalEscalation(
    source: PraxisCmpAgentLineage,
    targetAncestorID: String,
    reason: String
  ) -> PraxisEscalationPlan {
    PraxisEscalationPlan(
      targetAncestorID: targetAncestorID,
      severity: .critical,
      summary: "Escalate \(source.agentID) to \(targetAncestorID): \(reason)"
    )
  }

  private func mapRelation(_ targetKind: PraxisCmpDispatchTargetKind) -> PraxisCmpNeighborhoodRelation {
    switch targetKind {
    case .coreAgent:
      .same
    case .parent:
      .parent
    case .peer:
      .peer
    case .child:
      .child
    }
  }
}
