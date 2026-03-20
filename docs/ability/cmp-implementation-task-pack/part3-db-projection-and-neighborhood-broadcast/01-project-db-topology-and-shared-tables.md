# 01 Project DB Topology And Shared Tables

## 任务目标

定义项目级共享表。

## 必须完成

- `agent_registry`
- `agent_lineage`
- `branch_registry`
- `sync_event_registry`
- `promotion_registry`
- `delivery_registry`

## ownership

- 二层：`Part3 DB`
- 三层辅助：`DB SharedSchema`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `00`

## 最小验证义务

- 共享表字段足以表达 lineage、promotion、delivery

