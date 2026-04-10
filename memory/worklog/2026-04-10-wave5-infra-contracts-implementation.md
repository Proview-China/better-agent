# 2026-04-10 Wave5 InfraContracts Implementation

## 做了什么

- 作为 `Wave 5 / HostContracts` 的第一步，把 `PraxisInfraContracts` 从“协议存在”推进到“可被 HostRuntime 消费的稳定宿主 contract”。
- 补齐了以下 infra contract 面的 structured model：
  - checkpoint save receipt
  - journal append receipt / slice request
  - projection descriptor query / write receipt
  - message publication receipt / subscription
  - delivery truth query / upsert receipt
  - embedding write receipt
  - lineage descriptor / lookup request
  - semantic memory write receipt / bundle request

## 这次明确的边界

- `PraxisInfraContracts` 只定义宿主能力接缝，不承接 CMP / TAP / MP 业务规则。
- 这轮不引入 SQLite、message bus、semantic index 的真实 adapter。
- fake / stub / spy 允许放在 contract target 内作为测试替身，但不能伪装成生产 runtime adapter。

## 新增测试替身

- `PraxisFakeCheckpointStore`
- `PraxisFakeJournalStore`
- `PraxisFakeProjectionStore`
- `PraxisSpyMessageBus`
- `PraxisFakeDeliveryTruthStore`
- `PraxisFakeEmbeddingStore`
- `PraxisStubSemanticSearchIndex`
- `PraxisFakeSemanticMemoryStore`
- `PraxisStubLineageStore`

## 验证

- 新增 `PraxisInfraContractsTests`
- `swift test` 通过，当前共 `78` 个测试

## 对后续 Wave5 的影响

- 后续优先继续做：
  - `PraxisToolingContracts`
  - `PraxisWorkspaceContracts`
  - `PraxisProviderContracts`
  - `PraxisUserIOContracts`
- `PraxisRuntimeComposition` / `PraxisRuntimeUseCases` 下一步应优先消费这些 contract doubles，而不是提前写 live adapter。
