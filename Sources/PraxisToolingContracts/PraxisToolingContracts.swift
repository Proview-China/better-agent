import PraxisCoreTypes

// TODO(reboot-plan):
// - 实现 shell、browser、git、process supervision 的完整协议边界。
// - 补充 system git 可用性探测与首次安装引导的宿主契约。
// - 补充执行结果、超时、取消、流式输出和错误分类等契约。
// - 让 tooling contracts 保持“执行器协议层”，不反向带入领域规则。
// - 文件可继续拆分：ShellExecutor.swift、BrowserExecutor.swift、GitAvailabilityProbe.swift、GitExecutor.swift、ProcessSupervisor.swift。

public enum PraxisToolingContractsModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisToolingContracts",
    responsibility: "shell / browser / system git / process tooling 协议族。",
    tsModules: [
      "src/agent_core/integrations/tap-tooling",
      "src/agent_core/cmp-git/git-cli-backend.ts",
    ],
  )
}
