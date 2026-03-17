# WP2: AgentRun

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `AgentRun` 模块，作为 `agent_core raw runtime kernel` 的主循环壳与调度协调器。

## 项目背景

- 当前 kernel 的最小 loop 已经确定：
  `开始 -> 读取 run/goal/state/checkpoint -> 决定下一步 -> 内部推进或调用 capability -> 收 observation/result -> 写 event -> 更新 state -> 判断结束/暂停/失败 -> 继续下一轮`
- `AgentRun` 不允许直接执行能力块，也不允许直接侵入 `src/rax/**`
- `AgentRun` 必须通过事件驱动协调其他模块
- 强约束：
  - 不要直接调用 `CapabilityPort` 的具体执行实现
  - 只能产生 intent、消费 result event、推进 run 状态
- 性能方向要求：
  - `decision path / execution path / commit path` 分离
  - 单 run 决策串行
  - I/O 异步
  - commit 分离

## 你必须先阅读

- `docs/ability/16-agent-core-runtime-kernel-outline.md`
- `src/agent_core/types/**`
- `src/agent_core/transition/**`
- `src/agent_core/state/**`
- `src/agent_core/journal/**`

## 你的任务

1. 在 `src/agent_core/run/` 下实现 run 生命周期和最小 loop 协调器。
2. 让 run 只负责协调，不负责工具执行、状态计算、日志存储内部细节。
3. 正确接入：
  - `GoalFrame`
  - `StepTransition`
  - `AgentState`
  - `EventJournal`
4. 支持：
  - create
  - tick
  - suspend
  - resume
  - fail
  - complete

## 建议新增文件

- `src/agent_core/run/run-types.ts`
- `src/agent_core/run/run-coordinator.ts`
- `src/agent_core/run/run-lifecycle.ts`
- `src/agent_core/run/run-dispatch.ts`
- `src/agent_core/run/run-resume.ts`
- `src/agent_core/run/run-coordinator.test.ts`

## 边界约束

- 不要实现 capability 内部执行
- 不要自己计算 state 投影
- 不要自己存 checkpoint
- 不要写多 run DAG
- 不要写 speculative execution

## 必须考虑的性能点

- 单 run 不应出现并发双 tick
- 决策路径和提交路径要分开
- 通过 event 驱动恢复，不做大量同步阻塞
- 热路径尽量只读当前 state + goal + recent event

## 验证要求

- `npm run typecheck`
- 覆盖：
  - create -> deciding
  - deciding -> intent queued -> waiting
  - result event -> deciding
  - pause/resume
  - fail/complete
  - 重复 tick 不双执行

## 最终汇报格式

1. 你实现了哪些文件
2. run 的状态机主路径是什么
3. decision/execution/commit 是如何分离的
4. 你依赖了哪些外部模块接口
5. 后续联调最可能出问题的接口点是什么
