import XCTest
@testable import PraxisCoreTypes
@testable import PraxisGoal

final class PraxisGoalCompilerTests: XCTestCase {
  func testCreateGoalSourceKeepsSourceLayerSmallAndNormalized() throws {
    let source = PraxisGoalSource(
      id: .init(rawValue: "goal-source-1"),
      kind: .user,
      userInput: "  研究 agent runtime kernel  ",
      inputRefs: ["doc://outline"],
      constraints: [
        .init(key: "mode", value: "design"),
      ]
    )

    XCTAssertEqual(source.id.rawValue, "goal-source-1")
    XCTAssertEqual(source.userInput, "  研究 agent runtime kernel  ")
    XCTAssertEqual(source.inputRefs, ["doc://outline"])
    XCTAssertEqual(source.constraints, [.init(key: "mode", value: "design")])
  }

  func testNormalizeGoalPreservesCriteriaAndMergesConstraints() throws {
    let source = PraxisGoalSource(
      id: .init(rawValue: "goal-normalize-1"),
      kind: .user,
      userInput: "Define the runtime kernel",
      inputRefs: ["memory://current-context"],
      constraints: [
        .init(key: "scope", value: "raw-kernel"),
      ]
    )

    let normalized = try PraxisDefaultGoalNormalizer().normalize(
      source,
      options: .init(
        successCriteria: [
          .init(id: "done", description: "Kernel outline is concrete", required: true),
        ],
        failureCriteria: [
          .init(id: "blocked", description: "Task is still vague", required: true),
        ],
        additionalConstraints: [
          .init(key: "language", value: "typescript"),
        ]
      )
    )

    XCTAssertEqual(normalized.taskStatement, "Define the runtime kernel")
    XCTAssertEqual(
      normalized.successCriteria,
      [.init(id: "done", description: "Kernel outline is concrete", required: true)]
    )
    XCTAssertEqual(
      normalized.failureCriteria,
      [.init(id: "blocked", description: "Task is still vague", required: true)]
    )
    XCTAssertEqual(
      normalized.constraints,
      [
        .init(key: "scope", value: "raw-kernel"),
        .init(key: "language", value: "typescript"),
      ]
    )
    XCTAssertEqual(normalized.inputRefs, ["memory://current-context"])
  }

  func testCompileGoalInjectsConstraintsAndContextIntoInstructionText() throws {
    let normalized = try PraxisDefaultGoalNormalizer().normalize(
      PraxisGoalSource(
        id: .init(rawValue: "goal-compile-1"),
        kind: .user,
        userInput: "Implement goal frame compiler",
        constraints: [
          .init(key: "mode", value: "kernel-only"),
        ]
      ),
      options: .init(
        successCriteria: [
          .init(id: "spec", description: "compiled frame is deterministic", required: true),
        ]
      )
    )

    let compiled = try PraxisDefaultGoalCompiler().compile(
      normalized,
      context: .init(
        staticInstructions: ["Stay within src/agent_core/goal/**"],
        capabilityHints: [
          .init(key: "goal.compile", description: "compile source into instruction text"),
        ],
        contextSummary: "Raw kernel only, no governance layer."
      )
    )

    XCTAssertTrue(compiled.instructionText.contains("Task"))
    XCTAssertTrue(compiled.instructionText.contains("Implement goal frame compiler"))
    XCTAssertTrue(compiled.instructionText.contains("mode=\"kernel-only\""))
    XCTAssertTrue(compiled.instructionText.contains("Stay within src/agent_core/goal/**"))
    XCTAssertTrue(compiled.instructionText.contains("goal.compile: compile source into instruction text"))
    XCTAssertTrue(compiled.instructionText.contains("Raw kernel only, no governance layer."))
  }

  func testBuildGoalCompiledCacheKeyIsStableForSemanticallyIdenticalInputs() throws {
    let normalized = try PraxisDefaultGoalNormalizer().normalize(
      PraxisGoalSource(
        id: .init(rawValue: "goal-cache-1"),
        kind: .user,
        userInput: "Compile a goal",
        constraints: [
          .init(key: "mode", value: "design"),
        ]
      )
    )

    let compiler = PraxisDefaultGoalCompiler()
    let keyA = try compiler.buildGoalCompiledCacheKey(
      normalized,
      context: .init(
        staticInstructions: ["A", "B"],
        capabilityHints: [.init(key: "goal.compile", description: "desc")],
        metadata: ["z": 2, "a": 1]
      )
    )
    let keyB = try compiler.buildGoalCompiledCacheKey(
      normalized,
      context: .init(
        staticInstructions: ["A", "B"],
        capabilityHints: [.init(key: "goal.compile", description: "desc")],
        metadata: ["a": 1, "z": 2]
      )
    )

    XCTAssertEqual(keyA, keyB)
  }
}
