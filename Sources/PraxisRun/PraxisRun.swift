import PraxisCoreTypes
import PraxisState
import PraxisTransition

// TODO(reboot-plan):
// - 实现 RunAggregate、RunPhase、RunTick、RunFailure 等运行期核心模型。
// - 实现 run lifecycle、tick 协调、resume/fail/complete 纯规则。
// - 保持 run 只描述一次运行，不直接知道持久化、provider 或 UI。
// - 文件可继续拆分：RunModels.swift、RunLifecycle.swift、RunCoordinator.swift、RunRecovery.swift。

/// Stable blueprint describing the `PraxisRun` target responsibilities.
public struct PraxisRunBlueprint: Sendable, Equatable {
  public let responsibilities: [String]

  /// Creates the run blueprint.
  ///
  /// - Parameter responsibilities: Stable responsibility labels owned by the target.
  public init(responsibilities: [String]) {
    self.responsibilities = responsibilities
  }
}

/// Module-level boundary metadata for `PraxisRun`.
public enum PraxisRunModule {
  /// Architecture boundary descriptor for the run target.
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisRun",
    responsibility: "run 生命周期、tick 协调、恢复接续。",
    tsModules: [
      "src/agent_core/run",
    ],
  )

  /// Stable responsibility blueprint for the run target.
  public static let blueprint = PraxisRunBlueprint(
    responsibilities: [
      "create",
      "tick",
      "pause",
      "resume",
      "complete",
      "fail",
    ],
  )
}
