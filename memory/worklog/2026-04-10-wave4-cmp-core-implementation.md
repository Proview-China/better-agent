# 2026-04-10 Wave4 CMP Core Implementation

## 做了什么

- 按 `SWIFT_REFACTOR_PLAN.md` 的 Wave4 边界，把 CMP 八个子域从“占位骨架”推进到“可验证的纯 Core 模型 + planner”：
  - `PraxisCmpTypes`
  - `PraxisCmpSections`
  - `PraxisCmpProjection`
  - `PraxisCmpDelivery`
  - `PraxisCmpGitModel`
  - `PraxisCmpDbModel`
  - `PraxisCmpMqModel`
  - `PraxisCmpFiveAgent`
- 同步新增八个独立 Swift Testing 测试 target，覆盖各子域的最小规则面，不再只依赖架构守卫测试。

## 这次冻结的 Wave4 边界

- Wave4 只承接 CMP Core 规则层，不引入 Git CLI、SQLite/PostgreSQL 执行器、Redis/消息队列适配器、provider 推理执行器。
- Git / DB / MQ 在 Swift Wave4 内只允许以 model / planner / receipt / topology / lifecycle 形式存在。
- `cmp-service`、`runtime.ts`、`live-llm-model-executor.ts` 只作为旧 TS 行为参考，不作为 Swift target 结构模板。
- HostRuntime、CLI、AppleUI 本轮只允许做编译适配，不能反向决定 CMP Core 结构。

## 已落下的公共名词

- CMP 共用 ID、request / section / snapshot / projection / package / receipt 语义模型。
- lineage / neighborhood / visibility / delivery status / projection promotion 等共享枚举。
- six-entry action contract：
  - ingest runtime context
  - commit context delta
  - resolve checked snapshot
  - materialize context package
  - dispatch context package
  - request historical context
- five-agent role / handoff / live trace / tap bridge payload / runtime summary 纯模型。

## TS 对照来源

- `cmp-types`：`cmp-lineage.ts`、`cmp-context.ts`、`cmp-object-model.ts`、`cmp-delivery.ts`、`cmp-interface.ts`
- `cmp-runtime`：`section-ingress.ts`、`section-rules.ts`、`materialization.ts`、`visibility-enforcement.ts`、`runtime-snapshot.ts`、`runtime-recovery.ts`、`delivery.ts`、`delivery-routing.ts`、`passive-delivery.ts`、`active-line.ts`
- `cmp-git`：`cmp-git-types.ts`、`lineage-registry.ts`、`governance.ts`、`refs-lifecycle.ts`、`orchestrator.ts`、`lineage-guard.ts`
- `cmp-db`：`cmp-db-types.ts`、`project-db-topology.ts`、`agent-local-hot-tables.ts`、`projection-state.ts`、`delivery-registry.ts`
- `cmp-mq`：`cmp-mq-types.ts`、`topic-topology.ts`、`neighborhood-topology.ts`、`subscription-guards.ts`、`critical-escalation.ts`
- `cmp-five-agent`：`types.ts`、`shared.ts`、`configuration.ts`、`observability.ts`、`tap-bridge.ts`、`icma-runtime.ts`、`iterator-checker-runtime.ts`、`dbagent-runtime.ts`、`dispatcher-runtime.ts`

## 当前验证结果

- 新增的 CMP 八个测试 target 全部通过。
- `PraxisCmpArchitectureTests` 继续通过。
- 之前存在的 `HostRuntimeSurfaceTests` 文案断言已按当前实现更新，不再阻塞全量验证。
- `swift test` 全绿，当前共 `72` 个测试。

## 对后续 Wave5/6 的约束

- 后续如果要接入 SQLite、in-process actor bus、system git、provider adapter，只能走 `PraxisHostContracts` + `PraxisHostRuntime`。
- 不允许新增“大 CMP Core”或 `PraxisCmpService` 之类重新聚合八个 target 的 runtime target。
- 如果后续发现共享类型归属不清，优先下沉到更低层 target，不允许把子域回并。
