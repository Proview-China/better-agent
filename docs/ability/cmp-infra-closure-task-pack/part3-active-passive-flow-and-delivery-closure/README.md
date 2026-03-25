# CMP Infra Closure Part 3 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 3 负责把 active/passive flow、delivery path、parent-child reseed、peer exchange 在 real backend 上收口。

## 推荐文件列表

- `00-flow-closure-protocol-freeze.md`
- `01-active-ingest-to-git-db-mq-lowering.md`
- `02-passive-historical-read-path-on-real-backend.md`
- `03-parent-child-reseed-on-real-infra.md`
- `04-peer-exchange-stays-local-on-real-infra.md`
- `05-delivery-ack-retry-expiry-closure.md`
- `06-escalation-exception-on-real-backend.md`
- `07-flow-smoke-and-multi-lineage-fixtures.md`
- `08-cross-part-flow-closure-gates.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`

### Wave 2

- `02`
- `03`
- `04`

### Wave 3

- `05`
- `06`

### Wave 4

- `07`
- `08`

## 二层 agent 角色

### `Part3 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `08`

### `Active Flow Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `05`

### `Passive And Reseed Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `02`
  - `03`

### `Neighborhood And Escalation Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `04`
  - `06`
  - `07`

## 强依赖提醒

- Part 1 的 live executors/readback 没稳前，Part 3 只允许做受控 lowering，不要锁死 flow 结论。
- Part 2 的 recovery bridge 没稳前，不要提前把 interruption path 结论写死。
- `08` 必须最后收。

## 最小验收口径

- active/passive flow 都有 real-backend 证据。
- parent-child reseed 与 peer exchange 继续遵守原纪律。
- delivery ack/retry/expiry 路径在真实 backend 上有最小闭环。
