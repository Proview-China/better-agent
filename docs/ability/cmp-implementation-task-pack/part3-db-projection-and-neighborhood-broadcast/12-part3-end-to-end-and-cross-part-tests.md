# 12 Part3 End To End And Cross Part Tests

## 任务目标

覆盖 `git checked state -> DB projection -> MQ propagation -> dispatcher delivery` 的闭环。

## ownership

- 二层：`Part3 Lead`
- 三层辅助：
  - `Part3 TestPlanner`
  - `Part3 IntegrationAuditor`
- 模型：
  - 主写：`gpt-5.4-high`
  - 审计：`gpt-5.4-xhigh`

## 依赖前置

- `11`
- 与 Part 1/2/4 的 hook 至少接通一版

## 最小验证义务

- 子节点 checked snapshot 进入父节点 promoted projection
- 邻接广播只到父/平级/子代
- 父级同级必须中转
- dispatcher 只能分发高信噪比 package
- critical escalation 是唯一越级例外

