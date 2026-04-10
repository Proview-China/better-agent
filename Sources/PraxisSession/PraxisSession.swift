import PraxisCoreTypes

// TODO(reboot-plan):
// - 实现 SessionHeader、SessionAttachment、HotColdLifecycle 等会话模型。
// - 实现会话与 run/checkpoint 的挂载关系和生命周期边界。
// - 保证 session 不滑向 journal 或 runtime composition 的职责。
// - 文件可继续拆分：SessionModels.swift、SessionLifecycle.swift、SessionAttachment.swift、SessionIndexes.swift。

/// Stable blueprint describing the `PraxisSession` target responsibilities.
public struct PraxisSessionBlueprint: Sendable, Equatable {
  public let responsibilities: [String]

  /// Creates the session blueprint.
  ///
  /// - Parameter responsibilities: Stable responsibility labels owned by the target.
  public init(responsibilities: [String]) {
    self.responsibilities = responsibilities
  }
}

/// Module-level boundary metadata for `PraxisSession`.
public enum PraxisSessionModule {
  /// Architecture boundary descriptor for the session target.
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisSession",
    responsibility: "session header、冷热会话和 run 绑定。",
    tsModules: [
      "src/agent_core/session",
    ],
  )

  /// Stable responsibility blueprint for the session target.
  public static let blueprint = PraxisSessionBlueprint(
    responsibilities: [
      "header",
      "attach_run",
      "checkpoint_pointer",
      "hot_cold_storage",
    ],
  )
}
