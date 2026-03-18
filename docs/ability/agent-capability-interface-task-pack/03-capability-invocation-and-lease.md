# WP3: CapabilityInvocation And Lease

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现能力调用的热路径协议：`CapabilityInvocationPlan`、`CapabilityLease`、`PreparedCapabilityCall`、`CapabilityExecutionHandle`。

## 项目背景

- kernel 对池子的调用，本质上是：
  - 提交申请
  - 获取批准条
  - 转成 prepared call
  - 获得 execution handle
- 这是后续快路径、回压、队列、取消、热插拔的核心热对象

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/types/kernel-intents.ts`
- `src/agent_core/port/**`
- `src/agent_core/capability-types/**`

## 你的任务

1. 落地 invocation/lease/prepared/execution 的实际类型。
2. 提供最小构造器与辅助函数。
3. 明确它们和现有 `CapabilityPortRequest` / `CapabilityCallIntent` 的映射关系。
4. 为后续统一取消和长任务流式执行留口。

## 建议新增文件

- `src/agent_core/capability-invocation/capability-plan.ts`
- `src/agent_core/capability-invocation/capability-lease.ts`
- `src/agent_core/capability-invocation/capability-execution.ts`
- `src/agent_core/capability-invocation/capability-invocation.test.ts`
- `src/agent_core/capability-invocation/index.ts`

## 边界约束

- 不实现 pool registry
- 不实现 provider adapter
- 不要把 provider/model/layer 细节放到 kernel-facing 热对象

## 必须考虑的性能点

- 热路径对象必须短小可序列化
- cache key / idempotency key 的生成要稳定
- execution handle 不应持有大 payload

## 验证要求

- `npm run typecheck`
- 覆盖：
  - plan -> lease -> prepared -> handle 的最小链路
  - idempotency / timeout / priority 字段传递
  - 与旧 `CapabilityPortRequest` 的映射正确

## 最终汇报格式

1. 你实现了哪些文件
2. 这 4 个热路径对象各自负责什么
3. 它们和现有 kernel intent/request 的映射关系是什么
4. 你为取消/流式/长任务留了哪些扩展位
5. 后续 scheduler 最依赖哪些字段
