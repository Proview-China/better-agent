# 03 Projection State Machine And Promotion Contract

## 任务目标

冻结 projection visibility / promotion 状态机。

## 必须完成

- `local_only`
- `submitted_to_parent`
- `accepted_by_parent`
- `promoted_by_parent`
- `dispatched_downward`
- `archived`

## ownership

- 二层：`Part3 DB`
- 三层辅助：`DB ProjectionState`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`

## 最小验证义务

- 能覆盖父级接收、promotion、下发、归档
- 默认不允许越级可见

