# WP4: CapabilityPort

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `CapabilityPort` 模块，作为 kernel 调用外部能力块的统一 broker，具备 queue、priority、idempotency 和基础 backpressure 钩子。

## 项目背景

- 当前仓库已有 `src/rax/**` 能力块，但本任务不实现它们内部逻辑
- `CapabilityPort` 是 kernel 和能力块之间的统一执行边界
- 当前性能方向要求：
  - `queued-port`
  - `backpressure`
  - 只读 result cache
  - prepared invocation cache
- 强约束：
  - kernel 最终应通过 intent/result 事件与 port 协作
  - port 不负责 run loop 业务决策

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`
- `src/rax/index.ts` 仅用于理解现有能力块出口，不要改它

## 你的任务

1. 在 `src/agent_core/port/` 下实现 capability port broker。
2. 实现 intent 入队、出队、dispatch、complete 的生命周期。
3. 提供注册能力块适配器的接口。
4. 预留 backpressure 与缓存扩展点。

## 建议新增文件

- `src/agent_core/port/port-types.ts`
- `src/agent_core/port/port-broker.ts`
- `src/agent_core/port/port-queue.ts`
- `src/agent_core/port/port-registry.ts`
- `src/agent_core/port/port-idempotency.ts`
- `src/agent_core/port/port-backpressure.ts`
- `src/agent_core/port/port-broker.test.ts`

## 边界约束

- 不要实现具体 mcp/websearch/skill 执行器
- 不要直接改 `src/rax/**`
- 不要决定 agent 下一步做什么
- 不要把 port 变成服务发现平台
- 不要实现分布式消息队列

## 必须考虑的性能点

- queue 必须先成立
- priority 要可扩展
- idempotency key 去重
- 只缓存安全可重放结果
- port 负载要能被观测，为 backpressure 留口

## 验证要求

- `npm run typecheck`
- 覆盖：
  - enqueue/dequeue
  - idempotency hit
  - priority 顺序
  - backpressure signal
  - timeout / retry hook
  - result callback 回传

## 最终汇报格式

1. 你实现了哪些文件
2. port 的核心数据流是什么
3. queue、cache、backpressure 分别落在哪
4. 将来如何接 `src/rax/**`
5. 联调时最关键的事件/接口是什么
