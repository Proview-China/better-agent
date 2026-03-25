# CMP Infra Closure Part 2 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 2 负责把 runtime bootstrap、checkpoint、recovery、hydration 和 durable state 收口。

## 推荐文件列表

- `00-runtime-closure-protocol-freeze.md`
- `01-bootstrap-receipt-consumption.md`
- `02-runtime-durable-write-in-points.md`
- `03-checkpoint-to-backend-bridge.md`
- `04-hydration-and-state-rebuild.md`
- `05-interruption-restart-and-rejoin-path.md`
- `06-runtime-consistency-guard.md`
- `07-recovery-smoke-and-interruption-matrix.md`
- `08-cross-part-runtime-closure-gates.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`

### Wave 2

- `03`
- `04`

### Wave 3

- `05`
- `06`

### Wave 4

- `07`
- `08`

## 二层 agent 角色

### `Part2 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `06`
  - `08`

### `Bootstrap Receipt Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`

### `Recovery Worker`

- 模型：`gpt-5.4-xhigh`
- ownership：
  - `03`
  - `04`
  - `05`

### `Consistency And Smoke Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `07`

## 强依赖提醒

- Part 1 的 readback normalization 没稳前，不要把 receipt 接死进 runtime recovery。
- `03/04/05` 是 recovery 主轴，必须谨慎串行。
- `08` 必须最后收。

## 最小验收口径

- runtime 能消费 bootstrap receipt。
- checkpoint / recovery / hydration 在真实 backend 上有稳定桥接。
- interruption / restart / resume 有最小证据。
