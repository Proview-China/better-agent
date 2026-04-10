import PraxisCoreTypes

// TODO(reboot-plan):
// - 实现 user input、permission、terminal/conversation presentation 的协议族。
// - 补充结构化提问、权限决策回传、渲染事件、展示状态和 multimodal user-io chips 模型。
// - 保持 user I/O 只描述交互边界，不承担业务编排。
// - 文件可继续拆分：UserInputDriver.swift、PermissionDriver.swift、TerminalPresenter.swift、ConversationPresenter.swift、UserIOMultimodalRequests.swift。

public enum PraxisUserIOContractsModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisUserIOContracts",
    responsibility: "user input / permission / presenter 协议族。",
    tsModules: [
      "src/agent_core/live-agent-chat.ts",
      "src/agent_core/live-agent-chat/ui.ts",
      "src/agent_core/integrations/tap-vendor-user-io-adapter.ts",
    ],
  )
}
