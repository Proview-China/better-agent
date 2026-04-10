# 2026-04-10 macOS Local Runtime Policy

## 做了什么

- 明确 Swift/macOS 版采用本地优先运行方案：
  - `SQLite`
  - 进程内 `actor` / `AsyncStream`
  - `Accelerate`
  - system `git`
- 不把 `PostgreSQL`、`Redis`、`LanceDB` 作为 App 运行前置。

## 协议层调整

- `PraxisInfraContracts` 新增：
  - `PraxisDeliveryTruthStoreContract`
  - `PraxisEmbeddingStoreContract`
  - `PraxisSemanticSearchIndexContract`
- `PraxisToolingContracts` 新增：
  - `PraxisGitAvailabilityProbe`
- `PraxisCmpMqModel` 去掉 `Redis` 命名耦合：
  - `PraxisCmpRedisNamespace` -> `PraxisCmpMqNamespace`
  - `PraxisCmpRedisTopicBinding` -> `PraxisCmpMqTopicBinding`
  - `redisKey` -> `transportKey`

## 影响

- Swift 主路径接口不再把 `Postgres/Redis` 写死成默认宿主假设。
- 后续若要接具体实现，优先方向应是：
  - `SQLite` 承担结构化持久化与 delivery truth
  - 本地消息总线承担实时 fan-out
  - `Accelerate` 承担向量计算
  - system `git` 承担 canonical history

## 进一步接入

- `PraxisInspectCmpUseCase` 不再输出 `db/mq/readback` 风格摘要，改为输出本地运行画像：
  - `structuredStore`
  - `deliveryStore`
  - `messageBus`
  - `git`
  - `semanticIndex`
- `PraxisInspectionFacade` 与 presentation mapper 现在默认按 `macOS local runtime` 语义包装 CMP inspection。
- `PraxisRuntimeSurfaceModels` 也同步改为：
  - `PraxisLocalRuntimeHostProfile`
  - `PraxisCmpProjectLocalRuntimeSummary`
