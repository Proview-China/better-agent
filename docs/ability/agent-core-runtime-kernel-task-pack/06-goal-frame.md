# WP6: GoalFrame

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `GoalFrame` 模块，作为 raw kernel 的目标锚定层，采用 `source / normalized / compiled` 三层结构。

## 项目背景

- `GoalFrame` 不是完整提示词系统
- 它是 kernel 对“这次 run 为什么存在”的结构化表达
- 当前明确建议：
  - `source`
  - `normalized`
  - `compiled`
- 性能方向要求：
  - compiled cache key
  - static instruction reuse
  - 尽量减少重复拼装

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`

## 你的任务

1. 在 `src/agent_core/goal/` 下实现三层 goal frame。
2. 让 source 到 normalized 到 compiled 的转换清晰可测。
3. 支持 success/failure criteria、constraints、input refs。
4. 生成 compiled frame 的稳定 cache key。

## 建议新增文件

- `src/agent_core/goal/goal-types.ts`
- `src/agent_core/goal/goal-source.ts`
- `src/agent_core/goal/goal-normalizer.ts`
- `src/agent_core/goal/goal-compiler.ts`
- `src/agent_core/goal/goal-cache-key.ts`
- `src/agent_core/goal/goal-compiler.test.ts`

## 边界约束

- 不做 RAG
- 不做复杂 prompt routing graph
- 不做 capability 执行
- 不做治理层 context compaction

## 必须考虑的性能点

- normalized 结构稳定
- compiled 结果可缓存
- cache key 对语义稳定
- 尽量少做重复字符串拼装

## 验证要求

- `npm run typecheck`
- 覆盖：
  - source -> normalized
  - normalized -> compiled
  - success/failure criteria 保留
  - constraints 注入
  - compiled cache key 稳定性

## 最终汇报格式

1. 你实现了哪些文件
2. 三层 goal frame 最终结构是什么
3. compiled 层保留什么，不保留什么
4. cache key 如何构造
5. 与 run / transition 的接口点是什么
