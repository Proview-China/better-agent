import PraxisCheckpoint
import PraxisCmpDelivery
import PraxisCmpTypes
import PraxisCoreTypes
import PraxisJournal

// TODO(reboot-plan):
// - 实现 checkpoint、journal、projection、message bus、delivery truth、embedding store 的协议边界。
// - 补充 SQLite 持久化键、版本、读写一致性和批处理语义。
// - 补充本地 semantic search index、MP semantic memory store 与 Accelerate 相似度计算的协作边界。
// - 保证 infra 只描述基础设施能力，不承接 CMP/TAP 业务规则。
// - 文件可继续拆分：CheckpointStore.swift、JournalStore.swift、ProjectionStore.swift、MessageBus.swift、DeliveryTruthStore.swift、EmbeddingStore.swift、SemanticSearchIndex.swift、SemanticMemoryStore.swift、LineageStore.swift。

public enum PraxisInfraContractsModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisInfraContracts",
    responsibility: "checkpoint / projection store / message bus / local persistence / semantic search infra 协议族。",
    tsModules: [
      "src/agent_core/checkpoint",
      "src/agent_core/cmp-db",
      "src/agent_core/cmp-mq",
      "src/agent_core/mp-lancedb",
      "src/agent_core/mp-runtime",
    ],
  )
}
