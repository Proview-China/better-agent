import Testing
@testable import PraxisCoreTypes
@testable import PraxisGoal

struct PraxisGoalCompilerTests {
  @Test
  func createGoalSourceKeepsSourceLayerSmallAndNormalized() throws {
    let source = PraxisGoalSource(
      id: .init(rawValue: "goal-source-1"),
      kind: .user,
      userInput: "  研究 agent runtime kernel  ",
      inputRefs: ["doc://outline"],
      constraints: [
        .init(key: "mode", value: "design"),
      ]
    )

    #expect(source.id.rawValue == "goal-source-1")
    #expect(source.userInput == "  研究 agent runtime kernel  ")
    #expect(source.inputRefs == ["doc://outline"])
    #expect(source.constraints == [.init(key: "mode", value: "design")])
  }

  @Test
  func normalizeGoalPreservesCriteriaAndMergesConstraints() throws {
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

    #expect(normalized.taskStatement == "Define the runtime kernel")
    #expect(normalized.successCriteria == [.init(id: "done", description: "Kernel outline is concrete", required: true)])
    #expect(normalized.failureCriteria == [.init(id: "blocked", description: "Task is still vague", required: true)])
    #expect(
      normalized.constraints
        == [
          .init(key: "scope", value: "raw-kernel"),
          .init(key: "language", value: "typescript"),
        ]
    )
    #expect(normalized.inputRefs == ["memory://current-context"])
  }

  @Test
  func compileGoalInjectsConstraintsAndContextIntoInstructionText() throws {
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

    #expect(compiled.instructionText.contains("Task"))
    #expect(compiled.instructionText.contains("Implement goal frame compiler"))
    #expect(compiled.instructionText.contains("mode=\"kernel-only\""))
    #expect(compiled.instructionText.contains("Stay within src/agent_core/goal/**"))
    #expect(compiled.instructionText.contains("goal.compile: compile source into instruction text"))
    #expect(compiled.instructionText.contains("Raw kernel only, no governance layer."))
  }

  @Test
  func buildGoalCompiledCacheKeyIsStableForSemanticallyIdenticalInputs() throws {
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

    #expect(keyA == keyB)
  }
}
