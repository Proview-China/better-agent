# 02 Agent Local Hot Tables And Lineage Ownership

## 任务目标

定义每个 agent 的热表与 ownership 规则。

## 必须完成

- local events
- snapshots
- packages
- dispatch state
- ownership 边界

## ownership

- 二层：`Part3 DB`
- 三层辅助：`DB SharedSchema`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `00`

## 最小验证义务

- 没有把 MP/LanceDB 语义混进 CMP DB

