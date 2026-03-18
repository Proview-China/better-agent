# WP5: Capability Dispatch Scheduler

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现能力池的调度执行面：`acquire / prepare / dispatch / cancel`，并把 queue、idempotency、backpressure 正式纳入 pool。

## 项目背景

- 旧 `CapabilityPortBroker` 已有 queue、idempotency、backpressure 雏形
- 新阶段要把这些能力提升为 `CapabilityPool` 的一部分
- 目标不是重写一遍，而是升级成可承接热插拔与多 adapter 的调度面

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/port/**`
- `src/agent_core/capability-invocation/**`
- `src/agent_core/capability-pool/**`

## 你的任务

1. 在 `src/agent_core/capability-pool/` 下实现 dispatch scheduler。
2. 支持：
   - acquire
   - prepare
   - dispatch
   - cancel
3. 把旧的 queue / idempotency / backpressure 迁移或复用到新 pool 语义下。
4. 为 per-binding / per-provider 限流留口。

## 建议新增文件

- `src/agent_core/capability-pool/pool-dispatch.ts`
- `src/agent_core/capability-pool/pool-queue.ts`
- `src/agent_core/capability-pool/pool-backpressure.ts`
- `src/agent_core/capability-pool/pool-idempotency.ts`
- `src/agent_core/capability-pool/pool-dispatch.test.ts`

## 边界约束

- 不实现具体 provider adapter
- 不改 run loop 决策逻辑
- 不把审批逻辑和调度逻辑混在一起

## 必须考虑的性能点

- fast-path 支持直达 dispatch
- queued-path 支持排队和回压
- prepared cache / idempotency cache 只缓存安全内容
- per-binding / per-provider counters 要能观测

## 验证要求

- `npm run typecheck`
- 覆盖：
  - acquire -> prepare -> dispatch
  - idempotency hit
  - backpressure signal
  - cancel
  - direct vs queued mode

## 最终汇报格式

1. 你实现了哪些文件
2. scheduler 的核心数据流是什么
3. 旧 broker 的哪些能力被复用/替换了
4. fast-path 与 queued-path 如何区分
5. 后续 adapter 接入点在哪里
