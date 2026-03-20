# 04 Dispatcher Parent Child Peer Delivery

## 任务目标

定义主 agent 回填、子 agent 播种、平级交换与回执。

## ownership

- 二层：`Agent D`
- 三层辅助：
  - `D1 dispatcher state-machine specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `03` 的 package 形状至少稳定一版

## 最小验证义务

- 至少验证：
  - 主 agent 回填
  - 子 agent 播种
  - 平级交换但不自动 promotion
- 必须有 `DispatchReceipt` 回读

