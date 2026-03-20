# 06 Lineage Visibility And Non Skipping Enforcement

## 任务目标

实现非越级规则、父级中转、promotion/visibility enforcement。

## ownership

- 二层：
  - `Agent A`
  - `Agent D`
- 模型：`gpt-5.4-high`
- 如果卡在复杂状态机，可升级：
  - `gpt-5.4-xhigh`

## 依赖前置

- `04`
- `05`
- Part 2 `08`
- Part 3 `08/09`

## 最小验证义务

- visibility/promotion 状态机成立
- 非越级同步被阻断
- 可选加入极窄 `critical escalation` 测试

