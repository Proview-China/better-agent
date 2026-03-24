# CMP Infra Part 3 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 3 负责把 `CMP MQ` 真正落到 `Redis`。

它要解决的是：

- redis namespace bootstrap
- topic family 与 channel contract
- stream / pubsub / queue lane 选择
- ICMA publish envelope lowering
- parent / peer / child routing
- subscription guard
- critical escalation exception lane
- ack / retry / expiry signal
- `cmp-mq` adapter 与 runtime integration

一句白话：

- Part 3 管的是“上下文传播怎么在 Redis 里守纪律地跑”

## 推荐文件列表

- `00-part3-protocol-freeze.md`
- `01-redis-namespace-and-project-bootstrap.md`
- `02-topic-family-and-channel-contract.md`
- `03-stream-vs-pubsub-vs-queue-lane-selection.md`
- `04-icma-publish-envelope-to-redis-lowering.md`
- `05-parent-peer-child-routing-rules.md`
- `06-subscription-guard-and-neighborhood-ownership.md`
- `07-delivery-ack-retry-and-expiry-signal.md`
- `08-critical-escalation-exception-lane.md`
- `09-cmp-mq-redis-adapter-interface.md`
- `10-runtime-integration-and-readback-hooks.md`
- `11-fixtures-local-simulation-and-failure-matrix.md`
- `12-end-to-end-redis-neighborhood-smoke.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`
- `03`

### Wave 2

- `04`
- `05`
- `06`

### Wave 3

- `07`
- `08`
- `09`

### Wave 4

- `10`
- `11`

### Wave 5

- `12`

## 二层 agent 角色

### `Part3 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `10`
  - `12`

### `Redis Bootstrap Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`
  - `03`

### `Routing And Guard Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `04`
  - `05`
  - `06`
  - `08`

### `Delivery Signal Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `07`
  - `09`
  - `11`

## 三层 agent 角色

### `Redis Lane Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - stream / pubsub / queue lane selection

### `Neighborhood Routing Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - parent / peer / child routing
  - ownership rules

### `Subscription Guard Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - non-skipping guard
  - parent-peer direct block

### `Critical Escalation Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - critical escalation lane
  - alert-only / summary-only enforcement

### `Redis Smoke Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - local simulation
  - failure matrix
  - e2e smoke

## 强依赖提醒

- `00` 没完成前，其他文件不要动。
- `02/03` 没收稳前，不要正式写 `04/09`，否则 Redis adapter 会反复返工。
- `05/06` 没收稳前，不要真正开始 `10`，因为 runtime integration 会被 routing/guard 漂移拖垮。
- `08` 必须在 `05/06` 之后，因为 `critical escalation` 只能建立在默认非越级纪律已经冻结的前提上。
- `12` 必须最后收，而且要回读 Part 4 的 runtime wiring 需求。

## 与其它 Part 的依赖

- Part 1 依赖：
  - project identity
  - agent lineage identity
- Part 2 需要对齐：
  - package / delivery record
  - ack / retry / expiry 读回字段
- Part 4 强依赖：
  - `09`
  - `10`
  - `12`

## 最小验收口径

- 能为项目真实初始化 Redis namespace 与 topic family。
- ICMA publish envelope 能被正确 lowering 到 Redis lane。
- parent / peer / child routing 与 subscription guard 真实可用。
- `critical escalation` 保持唯一越级例外，并且只走 alert-only / summary-only。
- 至少有一次 redis neighborhood e2e smoke 与 readback 证据。
