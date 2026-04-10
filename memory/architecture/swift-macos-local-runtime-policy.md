# Swift macOS Local Runtime Policy

## 背景

- 当前 Swift 重构先只面向 `macOS`。
- 单机 App 必须尽量做到开箱即用，不能把 `PostgreSQL`、`Redis`、`LanceDB` 这类服务端依赖当成运行前置。
- 允许使用可直接随 App 打包或系统默认可获得的能力。

## 设计结论

- `SQLite` 是 macOS 版默认的结构化持久化底座。
- 进程内 `actor` / `AsyncStream` 是默认的实时消息传播底座。
- `Accelerate` 是默认的本地向量计算底座。
- `git` 允许依赖系统命令；若用户机器缺失，允许通过 macOS 的 `xcode-command-line-tools` 安装引导补齐。

## 依赖替换原则

### 1. `PostgreSQL`

- 不作为 macOS App 运行前置。
- 旧 TS 里由 `CMP DB` 承担的职责，迁到本地 `SQLite`：
  - projection truth
  - context package registry
  - delivery registry
  - shared control tables
  - checkpoint / journal index

一句白话：

- 这层要的是“结构化、可审计、可恢复”，不是“外部数据库服务”本身。

### 2. `Redis`

- 不作为 macOS App 运行前置。
- 旧 TS 里由 `CMP MQ` 承担的职责，迁到：
  - 进程内消息总线：负责实时 publish / subscribe / fan-out
  - `SQLite` delivery truth：负责 ack / retry / expiry / readback

一句白话：

- 这层要的是“本地实时协作 + 一点 durable truth”，不是“必须跑一个消息中间件”。

### 3. `LanceDB`

- 当前不进入 Swift 主路径。
- 若后续需要本地 embedding / retrieval：
  - `SQLite` 存 metadata、chunk ref、embedding ref
  - `Accelerate` 做 cosine / dot-product / top-k

一句白话：

- 现在先不要引入向量数据库；先把“存”和“算”拆开。

### 4. `git`

- 保留为 canonical history backbone。
- 当前允许直接调用系统 `git`。
- `git` 不应成为 App 启动硬前置，但可以成为特定能力的按需依赖。

一句白话：

- 没必要把 git 服务化，也没必要先内嵌一套数据库式替身。

## Swift 协议层约束

- `InfraContracts` 只暴露中性的 store / bus / search contract，不暴露 `Postgres` / `Redis` 产品名。
- `ToolingContracts` 可以暴露 `git readiness` 探测，因为系统 git 在 macOS 上是“可选增强但低摩擦”的宿主能力。
- `CmpMqModel` 与 `CmpDbModel` 可以保留领域语义，但模型名不应把具体产品名固化进主路径接口。

## 默认实现建议

- `PraxisCheckpointStoreContract` / `PraxisJournalStoreContract` / `PraxisProjectionStoreContract`
  - 默认由 `SQLite` 支持
- `PraxisDeliveryTruthStoreContract`
  - 默认由 `SQLite` 支持
- `PraxisMessageBusContract`
  - 默认由进程内 `actor` 支持
- `PraxisEmbeddingStoreContract`
  - 默认由 `SQLite` 或文件系统 + `SQLite` index 支持
- `PraxisSemanticSearchIndexContract`
  - 默认由 `Accelerate` + 本地候选集支持
- `PraxisGitAvailabilityProbe`
  - 默认通过系统 `git` 可用性探测实现

## 非目标

- 这一阶段不做多机共享状态。
- 不把 `CMP` 先拆成依赖独立服务的分布式形态。
- 不为将来可能的服务端部署，提前把 macOS 单机版复杂化。
