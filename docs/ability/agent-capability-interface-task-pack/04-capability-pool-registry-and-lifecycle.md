# WP4: CapabilityPool Registry And Lifecycle

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `CapabilityPool` 的 registry 与 lifecycle 基础能力。

## 项目背景

- pool 第一版不做治理中心，只做：
  - 注册能力
  - 管理 binding/generation
  - 发现可用能力
  - 基础 lifecycle
- 热插拔依赖：
  - `register`
  - `replace`
  - `suspend`
  - `resume`
  - `unregister`

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/capability-types/**`
- `src/agent_core/capability-model/**`

## 你的任务

1. 在 `src/agent_core/capability-pool/` 下实现 registry 与 lifecycle 子模块。
2. 支持：
   - register
   - unregister
   - replace
   - suspend
   - resume
   - listCapabilities
   - listBindings
3. 为 generation/draining 机制打底。

## 建议新增文件

- `src/agent_core/capability-pool/pool-registry.ts`
- `src/agent_core/capability-pool/pool-lifecycle.ts`
- `src/agent_core/capability-pool/pool-types.ts`
- `src/agent_core/capability-pool/pool-registry.test.ts`

## 边界约束

- 不实现 dispatch scheduler
- 不实现具体 adapter
- 不把审批 agent 做进来
- 不做 distributed registry

## 必须考虑的性能点

- registry 查询要支持 hot lookup
- generation 切换不能强行中断 inflight
- replace 不做原地大对象覆盖

## 验证要求

- `npm run typecheck`
- 覆盖：
  - register/list
  - replace 生成新 generation
  - suspend/resume
  - unregister + draining 约束

## 最终汇报格式

1. 你实现了哪些文件
2. registry 和 lifecycle 的职责怎么分
3. generation / draining 是怎么表示的
4. hot lookup 的关键索引是什么
5. 后续 scheduler / health 模块会依赖什么
