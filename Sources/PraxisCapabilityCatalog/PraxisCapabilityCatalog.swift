import PraxisCapabilityContracts
import PraxisCapabilityPlanning
import PraxisCoreTypes

// TODO(reboot-plan):
// - 实现 capability catalog、family registry、baseline set 与 discoverability 模型。
// - 实现从 manifest/planning 信息构建目录与过滤视图的规则。
// - 保证 catalog 只负责“系统有什么能力”，不承担实际执行。
// - 文件可继续拆分：CapabilityCatalogModels.swift、CapabilityCatalogBuilder.swift、CapabilityFamilyRegistry.swift、CapabilityDiscoveryPolicy.swift、CapabilityCatalogMPModels.swift。

public enum PraxisCapabilityCatalogModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisCapabilityCatalog",
    responsibility: "capability package、baseline capability sets 与 family catalog。",
    tsModules: [
      "src/agent_core/capability-package",
      "src/agent_core/capability-package/mp-family-capability-package.ts",
    ],
  )
}
