# 07 Runtime Assembly And Core Agent Integration

## 任务目标

把 Part 4 前面所有接口真正组装回 `core_agent` / `agent_core`。

## ownership

- 主线程统一负责
- 二层协作：
  - `Agent D`
- 模型：
  - 默认：`gpt-5.4-high`
  - 如遇全链路接口漂移或恢复复杂度激增：`gpt-5.4-xhigh`

## 依赖前置

- `01-06`
- Part 1 interface 已稳

## 最小验证义务

- `core_agent -> CMP ingress` 与 `CMP -> core_agent dispatch` 两个方向都已接线
- 与 Part 1 interface 完全对齐

