import PraxisCoreTypes
import PraxisGoal
import PraxisMpSearch
import PraxisMpTypes
import PraxisRuntimeComposition
import PraxisRun
import PraxisSession

// TODO(reboot-plan):
// - Implement high-level use cases such as runGoal, resumeRun, inspectTap, inspectCmp, inspectMp, searchMp, readbackMp, smokeMp, and buildCapabilityCatalog.
// - Keep use cases dependent only on capabilities exposed by composition instead of crossing layers to reach entry points or host implementations.
// - Design use-case inputs and outputs as stable DTOs that facades, CLI, SwiftUI, and FFI can reuse.
// - This file can later be split into GoalUseCases.swift, TapUseCases.swift, CmpUseCases.swift, MpUseCases.swift, and CapabilityUseCases.swift.

public struct PraxisUseCaseDescriptor: Sendable, Equatable, Identifiable {
  public let name: String
  public let summary: String

  public var id: String {
    name
  }

  public init(name: String, summary: String) {
    self.name = name
    self.summary = summary
  }
}

public enum PraxisRuntimeUseCasesModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisRuntimeUseCases",
    responsibility: "高层应用用例定义，例如 runGoal / inspectTap / inspectCmp / inspectMp。",
    tsModules: [
      "src/agent_core/runtime.ts",
      "src/agent_core/cmp-service",
      "src/agent_core/mp-runtime",
    ],
  )

  public static let useCases: [PraxisUseCaseDescriptor] = [
    .init(name: "runGoal", summary: "运行一轮目标编排"),
    .init(name: "resumeRun", summary: "恢复中断运行"),
    .init(name: "inspectTap", summary: "读取 TAP 治理视图"),
    .init(name: "inspectCmp", summary: "读取 CMP 项目视图"),
    .init(name: "recoverCmpProject", summary: "恢复 CMP 项目上下文导出"),
    .init(name: "inspectMp", summary: "读取 MP memory workflow 视图"),
    .init(name: "searchMp", summary: "检索 MP 语义记忆"),
    .init(name: "readbackMp", summary: "读取 MP 记忆分布与治理状态"),
    .init(name: "smokeMp", summary: "验证 MP 宿主能力接线"),
    .init(name: "ingestMp", summary: "写入并对齐一条 MP 候选记忆"),
    .init(name: "alignMp", summary: "对已有 MP 记忆重新执行 freshness/alignment judgement"),
    .init(name: "resolveMp", summary: "为当前请求解析 MP workflow bundle"),
    .init(name: "requestMpHistory", summary: "按 MP workflow bundle 读取历史上下文"),
    .init(name: "promoteMp", summary: "推进一条 MP 记忆的 promotion state 与可见性"),
    .init(name: "archiveMp", summary: "归档一条 MP 记忆而不删除底层真值"),
  ]
}
