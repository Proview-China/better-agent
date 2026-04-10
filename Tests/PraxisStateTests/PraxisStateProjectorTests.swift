import Testing
@testable import PraxisCoreTypes
@testable import PraxisState

struct PraxisStateProjectorTests {
  @Test
  func createInitialAgentStateReturnsFourRequiredSections() {
    let state = createInitialAgentState()

    #expect(state.control == .init(status: .created, phase: .decision, retryCount: 0))
    #expect(state.working == [:])
    #expect(state.observed == .init(artifactRefs: []))
    #expect(state.recovery == .init())
  }

  @Test
  func applyStateDeltaMergesWorkingStateRecursivelyAndClearsTopLevelKeys() throws {
    let initial = createInitialAgentState()
    let next = try applyStateDelta(
      initial,
      .init(
        working: [
          "plan": [
            "branch": "a",
            "depth": 1,
          ],
          "obsolete": "drop-me",
        ]
      )
    )
    let final = try applyStateDelta(
      next,
      .init(
        working: [
          "plan": [
            "depth": 2,
          ],
        ],
        clearWorkingKeys: ["obsolete"]
      )
    )

    #expect(
      final.working
        == [
          "plan": [
            "branch": "a",
            "depth": 2,
          ],
        ]
    )
  }

  @Test
  func applyStateDeltaRejectsForbiddenTopLevelHistoryLikeKeys() {
    do {
      _ = try applyStateDelta(
        createInitialAgentState(),
        .init(
          working: [
            "history": "should not be here",
          ]
        )
      )
      Issue.record("Expected applyStateDelta to reject forbidden top-level history key.")
    } catch {
      #expect(String(describing: error).contains("history"))
    }
  }

  @Test
  func projectStateFromEventsReplaysEventSequenceIntoState() throws {
    let events: [PraxisKernelEvent] = [
      .init(
        eventID: "evt-1",
        sessionID: "session-1",
        runID: "run-1",
        createdAt: "2026-03-17T10:00:00.000Z",
        payload: .runCreated(goalID: "goal-1")
      ),
      .init(
        eventID: "evt-2",
        sessionID: "session-1",
        runID: "run-1",
        createdAt: "2026-03-17T10:00:01.000Z",
        payload: .intentQueued(intentID: "intent-1", kind: "capability_call", priority: "high")
      ),
      .init(
        eventID: "evt-3",
        sessionID: "session-1",
        runID: "run-1",
        createdAt: "2026-03-17T10:00:02.000Z",
        payload: .intentDispatched(intentID: "intent-1", dispatchTarget: "websearch")
      ),
      .init(
        eventID: "evt-4",
        sessionID: "session-1",
        runID: "run-1",
        createdAt: "2026-03-17T10:00:03.000Z",
        payload: .capabilityResultReceived(requestID: "request-1", resultID: "result-1", status: "success")
      ),
      .init(
        eventID: "evt-5",
        sessionID: "session-1",
        runID: "run-1",
        createdAt: "2026-03-17T10:00:04.000Z",
        payload: .stateDeltaApplied(
          delta: .init(
            working: [
              "plan": [
                "step": "summarize",
              ],
            ],
            observed: .init(artifactRefs: ["artifact-1"])
          ),
          previousStatus: .acting,
          nextStatus: .deciding
        )
      ),
      .init(
        eventID: "evt-6",
        sessionID: "session-1",
        runID: "run-1",
        createdAt: "2026-03-17T10:00:05.000Z",
        payload: .checkpointCreated(checkpointID: "checkpoint-1", tier: "fast")
      ),
    ]

    let state = try PraxisDefaultStateProjector().project(from: events)

    #expect(state.control.phase == .commit)
    #expect(state.control.pendingIntentID == nil)
    #expect(state.observed.lastResultID == "result-1")
    #expect(state.observed.lastResultStatus == "success")
    #expect(state.observed.artifactRefs == ["artifact-1"])
    #expect(
      state.working
        == [
          "plan": [
            "step": "summarize",
          ],
        ]
    )
    #expect(state.recovery.lastCheckpointRef == "checkpoint-1")
    #expect(state.recovery.resumePointer == "evt-6")
  }

  @Test
  func validatorAcceptsSerializableStateAndSerializableDelta() {
    let validator = PraxisDefaultStateValidator()
    let state = createInitialAgentState()
    let delta = PraxisStateDelta(
      working: [
        "plan": [
          "step": "collect",
        ],
      ],
      observed: .init(artifactRefs: ["artifact-1"])
    )

    #expect(validator.validate(state).isEmpty)
    #expect(validator.validate(delta).isEmpty)
  }
}
