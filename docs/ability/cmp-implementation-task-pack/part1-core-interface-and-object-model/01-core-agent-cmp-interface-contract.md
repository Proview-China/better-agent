# 01 Core Agent CMP Interface Contract

## 任务目标

把 `CMP` 对 `core_agent` 暴露的最小 interface 合同写实。

## 必须完成

- 收口：
  - `ingest_runtime_context`
  - `commit_context_delta`
  - `resolve_checked_snapshot`
  - `materialize_context_package`
  - `dispatch_context_package`
  - `request_historical_context`
- 为每个接口写清：
  - 输入
  - 输出
  - 调用时机
  - 失败语义
  - 与 Part 2/3/4 的 ownership 边界

## ownership

- 三层：`L3-A interface specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`

## 串并行位置

- 可与 `02/03` 并行

## 最小验证义务

- 每个接口都能映射到 active 或 passive flow
- 不偷混 git / DB / MQ 的实现细节

