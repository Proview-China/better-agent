import Testing
@testable import PraxisCapabilityContracts
@testable import PraxisCapabilityPlanning
@testable import PraxisCoreTypes
@testable import PraxisGoal
@testable import PraxisRun

struct PraxisCapabilityPlannerTests {
  @Test
  func selectorPrefersExplicitCapabilityConstraint() {
    let selector = PraxisDefaultCapabilitySelector(
      availableCapabilities: [
        .init(
          id: .init(rawValue: "search.web"),
          name: "Web Search",
          summary: "Search web results.",
          hotPath: true,
          tags: ["search", "web"]
        ),
        .init(
          id: .init(rawValue: "code.read"),
          name: "Code Read",
          summary: "Read workspace files.",
          tags: ["code", "read"]
        ),
      ]
    )

    let goal = makeCompiledGoal(
      summary: "查一下 Swift Testing 的最新用法",
      constraints: [
        .init(key: "capability", value: "search.web"),
      ]
    )

    let selection = selector.select(for: goal)

    #expect(selection?.capabilityID == .init(rawValue: "search.web"))
    #expect(selection?.reason.contains("explicit capability constraint") == true)
  }

  @Test
  func plannerBuildsInvocationPlanFromSelection() {
    let selector = PraxisDefaultCapabilitySelector(
      availableCapabilities: [
        .init(
          id: .init(rawValue: "search.web"),
          name: "Web Search",
          summary: "Search web results.",
          hotPath: true,
          tags: ["search", "web"]
        ),
      ],
      bindings: [
        .init(
          capabilityID: .init(rawValue: "search.web"),
          bindingKey: "binding.search.default",
          state: .active
        ),
      ]
    )
    let planner = PraxisCapabilityPlanner(selector: selector)
    let goal = makeCompiledGoal(summary: "Search the web for SwiftPM testing guidance")

    let plan = planner.plan(
      for: goal,
      runID: PraxisRunID(rawValue: "run-1")
    )

    #expect(plan?.selection.capabilityID == .init(rawValue: "search.web"))
    #expect(plan?.dispatchPlan.runID == .init(rawValue: "run-1"))
    #expect(plan?.dispatchPlan.preferredBindingKey == "binding.search.default")
    #expect(plan?.lease?.holder == "planner")
    #expect(plan?.dispatchPlan.request.idempotencyKey == "goal.\(goal.cacheKey)")
  }

  private func makeCompiledGoal(
    summary: String,
    constraints: [PraxisGoalConstraint] = []
  ) -> PraxisCompiledGoal {
    let normalized = PraxisNormalizedGoal(
      id: .init(rawValue: "goal-1"),
      taskStatement: summary,
      title: "Goal",
      summary: summary,
      constraints: constraints,
      metadata: [
        "query": .string(summary),
      ]
    )
    return PraxisCompiledGoal(
      normalizedGoal: normalized,
      instructionText: summary,
      cacheKey: "cache.goal-1",
      metadata: normalized.metadata
    )
  }
}
