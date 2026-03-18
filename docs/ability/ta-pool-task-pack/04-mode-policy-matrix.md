# WP04: Mode Policy Matrix

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把 `strict / balanced / yolo` 的行为差异做成明确矩阵。

## 你的任务

1. 实现 mode policy 模型。
2. 明确不同 mode 下对 `B0-B3` 的处理差异。
3. 明确 yolo 下 reviewer 的行为阻断角色。
4. 输出可被 reviewer runtime 直接消费的决策矩阵。

## 建议修改文件

- `src/agent_core/ta-pool-model/**`
- `src/agent_core/ta-pool-review/**`

## 边界约束

- 不做真正的 LLM reviewer。
- 先做纯规则矩阵与辅助函数。

## 必须包含的测试

- 三种模式矩阵测试
- B3 在三种模式下的处理差异测试
