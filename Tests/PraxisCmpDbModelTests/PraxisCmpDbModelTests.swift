import Testing
@testable import PraxisCmpDbModel
@testable import PraxisCmpTypes

struct PraxisCmpDbModelTests {
  @Test
  func dbPlannerBuildsLocalTopologyAndRejectsBackwardProjectionState() {
    let planner = PraxisCmpDbPlanner()
    let topology = planner.makeProjectTopology(projectID: "project-1", databaseName: "praxis")
    let contract = planner.bootstrapContract(topology: topology, agentIDs: ["agent-1"])

    #expect(topology.storageEngine == .sqlite)
    #expect(contract.bootstrapStatements.count == contract.sharedTargets.count + contract.agentLocalTargets.count)

    var didThrow = false
    do {
      try planner.advanceProjectionState(from: .promotedByParent, to: .submittedToParent)
    } catch {
      didThrow = true
    }
    #expect(didThrow)
  }

  @Test
  func bootstrapContractPreservesDatabaseNameAndBuildsAgentLocalStatements() {
    let planner = PraxisCmpDbPlanner()
    let topology = planner.makeProjectTopology(projectID: "project-1", databaseName: "cmp-local")
    let contract = planner.bootstrapContract(topology: topology, agentIDs: ["agent-1"])

    #expect(topology.databaseName == "cmp-local")
    #expect(contract.databaseName == "cmp-local")
    #expect(contract.agentLocalTargets == [
      "agent-1.events",
      "agent-1.snapshots",
      "agent-1.packages",
      "agent-1.dispatch",
    ])
    #expect(contract.bootstrapStatements.map(\.target).contains("agent-1.events"))
    #expect(contract.readbackStatements.map(\.target).contains("agent-1.dispatch"))
    #expect(contract.bootstrapStatements.first { $0.target == "agent-1.events" }?.sql.contains("cmp_cmp_local.agent_1_events") == true)
  }
}
