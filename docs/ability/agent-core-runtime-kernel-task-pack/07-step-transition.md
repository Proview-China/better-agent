# WP7: StepTransition

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `StepTransition` 模块，作为 raw kernel 的表驱动有限状态机规则层。

## 项目背景

- 当前 kernel 明确要求：
  - `StepTransition` 是 run 的核心决策规则
  - 应优先采用 table-driven FSM
  - 应区分 hot path 与 rare path
- 它是纯函数规则层，不执行任何外部动作

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`
- `src/agent_core/state/**`
- `src/agent_core/goal/**`

## 你的任务

1. 在 `src/agent_core/transition/` 下实现 transition table 与 evaluator。
2. 输入当前 state、incoming event、goal frame，输出：
  - nextState
  - nextAction
  - stateDelta
  - reason
3. 清晰区分：
  - hot path
  - rare path

## 建议新增文件

- `src/agent_core/transition/transition-types.ts`
- `src/agent_core/transition/transition-table.ts`
- `src/agent_core/transition/transition-evaluator.ts`
- `src/agent_core/transition/transition-guards.ts`
- `src/agent_core/transition/transition-evaluator.test.ts`

## 边界约束

- 不执行 capability
- 不写 journal
- 不存 checkpoint
- 不做脚本化 FSM
- 不做热更新 DSL

## 必须考虑的性能点

- 单次 evaluate 足够轻
- transition table 清晰
- 非法迁移快速拒绝
- 输出 nextAction 必须稳定结构化

## 验证要求

- `npm run typecheck`
- 覆盖：
  - 合法状态迁移
  - 非法状态迁移
  - deciding/acting/waiting 热路径
  - paused/failed/cancelled 冷路径
  - 输出 stateDelta 正确

## 最终汇报格式

1. 你实现了哪些文件
2. transition table 的核心状态有哪些
3. hot path 和 rare path 如何区分
4. nextAction / stateDelta 如何输出
5. 与 `AgentRun` 的接口假设是什么
