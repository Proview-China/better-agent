# 08 Non Skipping Policy And Escalation Guard

## 任务目标

实现非越级治理规则与极窄 `critical escalation` 例外。

## 必须完成

- 默认无越级
- 仅允许极小越级 alert
- 不允许 raw history 越级

## ownership

- 二层：`Runtime Orchestrator Worker`
- 三层协作：`Guard Escalation Worker`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `05`
- `07`

## 最小验证义务

- 默认无越级
- 只有 critical escalation 允许极小 alert

