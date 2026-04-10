import PraxisCoreTypes
import PraxisSession

// TODO(reboot-plan):
// - 实现 JournalEvent、JournalCursor、AppendOnlyStream 等核心模型。
// - 实现事件追加、读取窗口、cursor 前进和读模型输入边界。
// - 保证 journal 只表达事件流真相，不承担 session/run 业务判断。
// - 文件可继续拆分：JournalEvent.swift、JournalCursor.swift、JournalStream.swift、JournalReadModelInput.swift。

/// Stable blueprint describing the `PraxisJournal` target responsibilities.
public struct PraxisJournalBlueprint: Sendable, Equatable {
  public let responsibilities: [String]

  /// Creates the journal blueprint.
  ///
  /// - Parameter responsibilities: Stable responsibility labels owned by the target.
  public init(responsibilities: [String]) {
    self.responsibilities = responsibilities
  }
}

/// Module-level boundary metadata for `PraxisJournal`.
public enum PraxisJournalModule {
  /// Architecture boundary descriptor for the journal target.
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisJournal",
    responsibility: "append-only journal、cursor 与 flush 触发。",
    tsModules: [
      "src/agent_core/journal",
    ],
  )

  /// Stable responsibility blueprint for the journal target.
  public static let blueprint = PraxisJournalBlueprint(
    responsibilities: [
      "append",
      "read",
      "cursor",
      "flush",
    ],
  )
}
