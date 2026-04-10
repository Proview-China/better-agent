import XCTest
@testable import PraxisCoreTypes
@testable import PraxisState

final class PraxisStateProjectorTests: XCTestCase {
  func testCreateInitialAgentStateReturnsFourRequiredSections() {
    let state = createInitialAgentState()

    XCTAssertEqual(
      state.control,
      .init(status: .created, phase: .decision, retryCount: 0)
    )
    XCTAssertEqual(state.working, [:])
    XCTAssertEqual(state.observed, .init(artifactRefs: []))
    XCTAssertEqual(state.recovery, .init())
  }

  func testApplyStateDeltaMergesWorkingStateRecursivelyAndClearsTopLevelKeys() throws {
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

    XCTAssertEqual(
      final.working,
      [
        "plan": [
          "branch": "a",
          "depth": 2,
        ],
      ]
    )
  }

  func testApplyStateDeltaRejectsForbiddenTopLevelHistoryLikeKeys() {
    XCTAssertThrowsError(
      try applyStateDelta(
        createInitialAgentState(),
        .init(
          working: [
            "history": "should not be here",
          ]
        )
      )
    ) { error in
      XCTAssertTrue(String(describing: error).contains("history"))
    }
  }

  func testProjectStateFromEventsReplaysEventSequenceIntoState() throws {
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

    XCTAssertEqual(state.control.phase, .commit)
    XCTAssertNil(state.control.pendingIntentID)
    XCTAssertEqual(state.observed.lastResultID, "result-1")
    XCTAssertEqual(state.observed.lastResultStatus, "success")
    XCTAssertEqual(state.observed.artifactRefs, ["artifact-1"])
    XCTAssertEqual(
      state.working,
      [
        "plan": [
          "step": "summarize",
        ],
      ]
    )
    XCTAssertEqual(state.recovery.lastCheckpointRef, "checkpoint-1")
    XCTAssertEqual(state.recovery.resumePointer, "evt-6")
  }

  func testValidatorAcceptsSerializableStateAndSerializableDelta() {
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

    XCTAssertTrue(validator.validate(state).isEmpty)
    XCTAssertTrue(validator.validate(delta).isEmpty)
  }
}
