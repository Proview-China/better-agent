import Testing
import PraxisMpSearch
import PraxisMpTypes

struct PraxisMpSearchTests {
  @Test
  func mpSearchRankingPrefersFreshAlignedRecordsAndFiltersSupersededByDefault() {
    let scope = PraxisMpScopeDescriptor(projectID: "mp.local-runtime", agentID: "runtime.local")
    let fresh = PraxisMpMemoryRecord(
      id: "memory.fresh",
      scope: scope,
      summary: "Host runtime onboarding note",
      storageKey: "memory/fresh",
      freshness: .init(status: .fresh),
      alignment: .init(status: .aligned),
      updatedAt: "2026-04-11T10:00:00Z"
    )
    let stale = PraxisMpMemoryRecord(
      id: "memory.stale",
      scope: scope,
      summary: "Host runtime onboarding note older copy",
      storageKey: "memory/stale",
      freshness: .init(status: .stale),
      alignment: .init(status: .aligned),
      updatedAt: "2026-04-10T10:00:00Z"
    )
    let superseded = PraxisMpMemoryRecord(
      id: "memory.superseded",
      scope: scope,
      summary: "Host runtime onboarding note superseded",
      storageKey: "memory/superseded",
      freshness: .init(status: .superseded),
      alignment: .init(status: .aligned),
      updatedAt: "2026-04-09T10:00:00Z"
    )

    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "onboarding",
      scopeLevels: [.agentIsolated],
      limit: 5
    )
    let hits = PraxisMpSearchRankingService().rank(
      records: [stale, superseded, fresh],
      semanticScoresByStorageKey: [
        "memory/stale": 0.95,
        "memory/fresh": 0.40,
        "memory/superseded": 0.99,
      ],
      plan: plan
    )

    #expect(hits.map(\.memory.id) == ["memory.fresh", "memory.stale"])
    #expect(hits.first?.rankExplanation.contains("freshness=fresh") == true)
  }

  @Test
  func mpSearchPlanNormalizesEmptyScopesAndLimitBounds() {
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: " host runtime ",
      scopeLevels: [],
      limit: 200
    )

    #expect(plan.query == "host runtime")
    #expect(plan.scopeLevels.count == PraxisMpScopeLevel.allCases.count)
    #expect(plan.limit == 50)
  }

  @Test
  func searchProjectionServiceBuildsStableSummaryAndFlattenedHits() {
    let scope = PraxisMpScopeDescriptor(projectID: "mp.local-runtime", agentID: "runtime.local")
    let memory = PraxisMpMemoryRecord(
      id: "memory.primary",
      scope: scope,
      summary: "Host runtime onboarding note",
      storageKey: "memory/primary",
      memoryKind: .semantic,
      freshness: .init(status: .fresh),
      alignment: .init(status: .aligned),
      updatedAt: "2026-04-11T10:00:00Z"
    )
    let plan = PraxisMpSearchPlanningService().makePlan(
      projectID: "mp.local-runtime",
      query: "onboarding",
      scopeLevels: [.agentIsolated],
      limit: 5
    )
    let hits = [
      PraxisMpSearchHit(
        memory: memory,
        semanticScore: 0.91,
        finalScore: 42,
        rankExplanation: "freshness=fresh, alignment=aligned"
      )
    ]

    let projection = PraxisMpSearchProjectionService().project(
      hits: hits,
      candidateCount: 3,
      plan: plan
    )

    #expect(projection.summary == "MP search ranked 1 hit(s) from 3 candidate memory record(s) across 1 scope level(s).")
    #expect(projection.hits.map(\.memoryID) == ["memory.primary"])
    #expect(projection.hits.first?.agentID == "runtime.local")
    #expect(projection.hits.first?.scopeLevel == .agentIsolated)
    #expect(projection.hits.first?.semanticScore == 0.91)
  }
}
