import PraxisCoreTypes
import PraxisGoal
import PraxisRuntimeComposition
import PraxisRun
import PraxisSession

// TODO(reboot-plan):
// - 实现 runGoal、resumeRun、inspectTap、inspectCmp、inspectMp、buildCapabilityCatalog 等高层用例。
// - 约束用例只依赖 composition 暴露的能力，不直接越层拿入口或宿主实现。
// - 把 use case 输入输出设计成稳定 DTO，方便 facade、CLI、SwiftUI 和 FFI 复用。
// - 文件可继续拆分：GoalUseCases.swift、TapUseCases.swift、CmpUseCases.swift、MpUseCases.swift、CapabilityUseCases.swift。

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
    .init(name: "inspectMp", summary: "读取 MP memory workflow 视图"),
  ]
}
