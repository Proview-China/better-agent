# WP11: Hot Swap, Drain And Health

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

为能力池实现热插拔相关的 generation / draining / health 基础语义。

## 项目背景

- 这轮接口总纲已经明确：
  - 热插拔必须成立
  - 但不允许污染 kernel 主 loop
- 所以热插拔、drain、health 应属于 pool 的 lifecycle/ops 面

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/capability-model/**`
- `src/agent_core/capability-pool/**`

## 你的任务

1. 为 binding 增加 generation 切换与 draining 状态管理。
2. 实现最小 health contract：
   - `healthy`
   - `degraded`
   - `blocked`
   - `disabled`
3. 明确：
   - register 新 generation
   - old generation drain
   - inflight 完成后摘除
4. 输出给 scheduler 的可消费状态。

## 建议新增文件

- `src/agent_core/capability-pool/pool-health.ts`
- `src/agent_core/capability-pool/pool-drain.ts`
- `src/agent_core/capability-pool/pool-health.test.ts`

## 边界约束

- 不实现治理层 approval agent
- 不实现复杂熔断集群
- 不做跨进程协调

## 必须考虑的性能点

- generation 切换不能阻塞热路径
- draining 不能引起 registry 全量扫描
- health 状态最好可缓存/快读

## 验证要求

- `npm run typecheck`
- 覆盖：
  - new generation register
  - old generation draining
  - inflight drain 完成后摘除
  - degraded/blocked 状态影响选择

## 最终汇报格式

1. 你实现了哪些文件
2. generation / draining 的协议是什么
3. health 怎么表达，给谁消费
4. 热插拔为什么没有污染 kernel
5. 后续真正加审批 agent 时，挂点在哪里
