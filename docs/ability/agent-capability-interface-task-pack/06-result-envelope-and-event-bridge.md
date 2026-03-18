# WP6: Result Envelope And Event Bridge

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

统一 `CapabilityResultEnvelope`，并把 pool 执行结果正确桥接回 `agent_core` 的 event / state / run 推进面。

## 项目背景

- 现有 kernel 事件里只有 `capability.result_received`
- 现有 `model_inference` 还在借用这个事件并靠 metadata 区分
- 新阶段要求：
  - 结果壳更统一
  - 事件语义更清晰
  - 为 partial/progress/cancel 留口

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/types/kernel-events.ts`
- `src/agent_core/types/kernel-results.ts`
- `src/agent_core/run/**`
- `src/agent_core/transition/**`

## 你的任务

1. 统一 result envelope 与 kernel result/event 的映射关系。
2. 明确：
   - completed
   - failed
   - blocked
   - timeout
   - cancelled
   - partial/progress 预留位
3. 评估是否引入新的 event type，或在现有 event 上增加更清晰的 payload。
4. 为后续把 `model_inference` 拉回统一能力面打基础。

## 建议新增或修改的文件

- `src/agent_core/capability-result/result-envelope.ts`
- `src/agent_core/capability-result/result-event-bridge.ts`
- `src/agent_core/capability-result/result-event-bridge.test.ts`
- 以及必要的 `src/agent_core/types/**`

## 边界约束

- 不改 provider adapter 逻辑
- 不在这里实现完整 scheduler
- 不做治理审批

## 必须考虑的性能点

- result bridge 不能把大 payload 塞进热 state
- evidence/artifact 尽量走引用或轻量壳
- event bridge 不引入重复 journal append

## 验证要求

- `npm run typecheck`
- 覆盖：
  - success/failed/blocked/timeout/cancelled 映射
  - result -> event -> run tick
  - 不重复提交同一个结果

## 最终汇报格式

1. 你实现了哪些文件
2. result envelope 的最终标准形状是什么
3. kernel event 语义是否有调整
4. 你为 partial/progress/cancel 留了哪些口
5. 后续 `model_inference` 统一化还差什么
